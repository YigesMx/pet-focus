use std::{
    borrow::Cow,
    collections::HashMap,
    sync::atomic::{AtomicU32, Ordering},
    time::Duration,
};

use anyhow::{anyhow, Context, Result};
use chrono::{DateTime, NaiveDate, NaiveDateTime, NaiveTime, Utc, TimeZone};
use chrono_tz::Tz;
use quick_xml::{events::Event, Reader};
use reqwest::{header, Client, Method, Request, StatusCode};
use serde::Serialize;
use url::Url;
use uuid::Uuid;

use super::config::CalDavConfig;

const USER_AGENT: &str = "pet-focus-caldav/0.1";
const CALENDAR_QUERY_XML: &str = r#"<?xml version="1.0" encoding="utf-8"?>
<cal:calendar-query xmlns:cal="urn:ietf:params:xml:ns:caldav" xmlns:d="DAV:">
    <d:prop>
        <d:getetag />
        <cal:calendar-data />
    </d:prop>
    <cal:filter>
        <cal:comp-filter name="VCALENDAR">
            <cal:comp-filter name="VTODO" />
        </cal:comp-filter>
    </cal:filter>
</cal:calendar-query>
"#;

#[derive(Debug, Clone, Serialize)]
pub struct CalDavItem {
    pub uid: String,
    pub summary: String,
    pub description: Option<String>,
    pub status: Option<String>,
    pub percent_complete: Option<i32>,
    pub priority: Option<i32>,
    pub location: Option<String>,
    pub categories: Vec<String>,
    pub start: Option<DateTime<Utc>>,
    pub due: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub last_modified: Option<DateTime<Utc>>,
    pub reminder_minutes: Option<i32>,
    pub timezone: Option<String>,
    pub recurrence_rule: Option<String>,
    pub related_to: Option<String>,  // 父任务的 UID (用于子任务)
}

impl CalDavItem {
    pub fn is_completed(&self) -> bool {
        matches!(self.status.as_deref(), Some("COMPLETED")) || self.percent_complete == Some(100)
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct RemoteTodo {
    pub href: String,
    pub etag: Option<String>,
    pub item: CalDavItem,
    pub raw_ical: String,
}

#[derive(Debug, Clone)]
pub struct UploadResult {
    pub href: String,
    pub etag: Option<String>,
}

#[derive(Debug)]
pub struct CalDavClient {
    http: Client,
    calendar_url: Url,
    username: String,
    password: String,
    nonce_count: AtomicU32,
}

impl CalDavClient {
    pub fn new(config: &CalDavConfig) -> Result<Self> {
        let normalized_url = format!("{}/", config.url.trim_end_matches('/'));
        eprintln!("[CalDAV] Creating client with URL: {}", normalized_url);
        eprintln!("[CalDAV] Username: {}", config.username);
        
        let calendar_url = Url::parse(&normalized_url).context("invalid CalDAV calendar URL")?;

        let http = Client::builder()
            .user_agent(USER_AGENT)
            .timeout(Duration::from_secs(45))
            .build()
            .context("failed to build HTTP client")?;

        Ok(Self {
            http,
            calendar_url,
            username: config.username.clone(),
            password: config.password.clone(),
            nonce_count: AtomicU32::new(0),
        })
    }

    pub fn calendar_url(&self) -> &Url {
        &self.calendar_url
    }

    pub async fn fetch_todos(&self) -> Result<Vec<RemoteTodo>> {
        eprintln!("[CalDAV] Fetching todos from: {}", self.calendar_url);
        eprintln!("[CalDAV] Username: {}", self.username);
        
        let method = Method::from_bytes(b"REPORT")
            .map_err(|err| anyhow!("failed to create REPORT method: {err}"))?;

        let headers = [
            (
                header::HeaderName::from_static("content-type"),
                "application/xml; charset=utf-8".to_string(),
            ),
            (header::HeaderName::from_static("depth"), "1".to_string()),
        ];

        eprintln!("[CalDAV] Sending REPORT request...");
        let response = self
            .send_authenticated_request(
                method,
                &self.calendar_url,
                &headers,
                Some(CALENDAR_QUERY_XML),
            )
            .await?;

        let status = response.status();
        eprintln!("[CalDAV] Response status: {}", status);
        
        if !status.is_success() {
            let text = response.text().await.unwrap_or_default();
            eprintln!("[CalDAV] Error response body: {}", text);
            return Err(anyhow!("CalDAV REPORT failed: {status} {text}"));
        }

        let xml = response
            .text()
            .await
            .context("failed to read CalDAV REPORT response")?;

        println!("\n========== CalDAV XML Response ==========\n{}", xml);
        println!("=========================================\n");

        let items = parse_multistatus(&xml)
            .with_context(|| "failed to parse CalDAV multistatus response")?;

        let mut todos = Vec::with_capacity(items.len());
        for item in items {
            let absolute_href = self.resolve_href(&item.href)?;
            
            println!("\n========== Raw iCalendar Data for {} ==========\n{}", absolute_href, item.calendar_data);
            println!("=========================================\n");
            
            let parsed = parse_ical_todo(&item.calendar_data)
                .with_context(|| format!("failed to parse VTODO from {}", absolute_href))?;
            todos.push(RemoteTodo {
                href: absolute_href.to_string(),
                etag: item.etag,
                item: parsed,
                raw_ical: item.calendar_data,
            });
        }

        Ok(todos)
    }

    pub async fn create_todo(&self, uid: &str, ics: &str) -> Result<UploadResult> {
        let resource = self
            .calendar_url
            .join(&format!("{}.ics", uid))
            .with_context(|| format!("failed to build CalDAV resource URL for uid {uid}"))?;

        self.put_resource(&resource, ics, None, true).await
    }

    pub async fn update_todo(
        &self,
        href: &str,
        ics: &str,
        etag: Option<&str>,
    ) -> Result<UploadResult> {
        let resource = self.resolve_href(href)?;
        self.put_resource(&resource, ics, etag, false).await
    }

    /// 获取单个 Todo（用于冲突解决时获取远端最新版本）
    pub async fn get_todo(&self, href: &str) -> Result<RemoteTodo> {
        let resource = self.resolve_href(href)?;
        
        let response = self
            .send_authenticated_request(Method::GET, &resource, &[], None)
            .await?;

        let status = response.status();
        if !status.is_success() {
            let text = response.text().await.unwrap_or_default();
            return Err(anyhow!("CalDAV GET failed: {status} {text}"));
        }

        // 从响应头获取 ETag
        let etag = response
            .headers()
            .get(header::ETAG)
            .and_then(|v| v.to_str().ok())
            .map(|s| s.trim_matches('"').to_string());

        let ical_data = response
            .text()
            .await
            .context("failed to read CalDAV GET response")?;

        let item = parse_ical_todo(&ical_data)
            .with_context(|| format!("failed to parse VTODO from {}", href))?;

        Ok(RemoteTodo {
            href: href.to_string(),
            etag,
            item,
            raw_ical: ical_data,
        })
    }

    pub async fn delete_todo(&self, href: &str, etag: Option<&str>) -> Result<()> {
        let resource = self.resolve_href(href)?;
        let mut headers: Vec<(header::HeaderName, String)> = Vec::new();

        if let Some(tag) = etag {
            headers.push((header::HeaderName::from_static("if-match"), tag.to_string()));
        }

        let response = self
            .send_authenticated_request(Method::DELETE, &resource, &headers, None)
            .await?;

        if !response.status().is_success() && response.status() != StatusCode::NOT_FOUND {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(anyhow!("CalDAV DELETE failed: {status} {text}"));
        }

        Ok(())
    }

    fn resolve_href(&self, href: &str) -> Result<Url> {
        // 如果是完整URL，直接解析
        if href.starts_with("http://") || href.starts_with("https://") {
            return Url::parse(href).context("invalid CalDAV resource href");
        }

        // 如果是绝对路径（以 / 开头），使用服务器的 origin
        if href.starts_with('/') {
            let origin = self.calendar_url.origin();
            let base_url = Url::parse(&origin.ascii_serialization())
                .context("failed to parse calendar URL origin")?;
            let result = base_url
                .join(href.trim_start_matches('/'))
                .with_context(|| format!("failed to resolve absolute href: {href}"))?;
            return Ok(result);
        }

        // 相对路径，使用 calendar_url 拼接
        let result = self.calendar_url
            .join(href)
            .with_context(|| format!("failed to resolve CalDAV resource href: {href}"))?;
        Ok(result)
    }

    async fn send_authenticated_request(
        &self,
        method: Method,
        url: &Url,
        headers: &[(header::HeaderName, String)],
        body: Option<&str>,
    ) -> Result<reqwest::Response> {
        eprintln!("[CalDAV Auth] Sending request: {} {}", method, url);
        
        let request = self.build_request(method.clone(), url, headers, body, None)?;
        let mut response = self
            .http
            .execute(request)
            .await
            .with_context(|| format!("failed to execute {method} {url}"))?;

        let status = response.status();
        eprintln!("[CalDAV Auth] Initial response status: {}", status);
        
        if status == StatusCode::UNAUTHORIZED {
            eprintln!("[CalDAV Auth] Got 401, attempting digest authentication...");
            let challenge = self.extract_digest_challenge(&response)?;
            eprintln!("[CalDAV Auth] Digest challenge: realm={}, nonce={}", 
                challenge.realm, challenge.nonce);
            
            let uri = request_uri(url);
            let digest_header = self.build_digest_authorization(&challenge, &method, &uri, body)?;
            let retry_request =
                self.build_request(method.clone(), url, headers, body, Some(&digest_header))?;
            response = self.http.execute(retry_request).await.with_context(|| {
                format!("failed to execute digest-authenticated {method} {url}")
            })?;

            let retry_status = response.status();
            eprintln!("[CalDAV Auth] Retry response status: {}", retry_status);
            
            if retry_status == StatusCode::UNAUTHORIZED {
                let text = response.text().await.unwrap_or_default();
                eprintln!("[CalDAV Auth] Authentication failed after retry: {}", text);
                return Err(anyhow!(
                    "CalDAV credentials rejected with 401 Unauthorized: {text}"
                ));
            }
        }
        
        if status == StatusCode::FORBIDDEN {
            let text = response.text().await.unwrap_or_default();
            eprintln!("[CalDAV Auth] Got 403 Forbidden: {}", text);
            return Err(anyhow!("CalDAV request forbidden (403): {text}"));
        }

        Ok(response)
    }

    fn build_request(
        &self,
        method: Method,
        url: &Url,
        headers: &[(header::HeaderName, String)],
        body: Option<&str>,
        authorization: Option<&str>,
    ) -> Result<Request> {
        let mut builder = self.http.request(method, url.clone());

        for (name, value) in headers.iter() {
            builder = builder.header(name, value.as_str());
        }

        if let Some(body) = body {
            builder = builder.body(body.to_string());
        }

        if let Some(value) = authorization {
            builder = builder.header(header::AUTHORIZATION, value);
        } else {
            builder = builder.basic_auth(&self.username, Some(&self.password));
        }

        builder.build().context("failed to build CalDAV request")
    }

    fn extract_digest_challenge(&self, response: &reqwest::Response) -> Result<DigestChallenge> {
        let challenges = response.headers().get_all(header::WWW_AUTHENTICATE);
        for value in challenges.iter() {
            if let Ok(text) = value.to_str() {
                if let Some(challenge) = DigestChallenge::parse(text) {
                    return Ok(challenge);
                }
            }
        }

        Err(anyhow!(
            "server requested authentication but provided no Digest challenge"
        ))
    }

    fn build_digest_authorization(
        &self,
        challenge: &DigestChallenge,
        method: &Method,
        uri: &str,
        body: Option<&str>,
    ) -> Result<String> {
        let algorithm = challenge
            .algorithm
            .as_deref()
            .unwrap_or("MD5")
            .to_ascii_uppercase();

        let qop_token = challenge.preferred_qop();

        let cnonce = Uuid::new_v4().as_simple().to_string();
        let nc_value = self.nonce_count.fetch_add(1, Ordering::SeqCst) + 1;
        let nc = format!("{:08x}", nc_value);

        let ha1_source = format!("{}:{}:{}", self.username, challenge.realm, self.password);
        let mut ha1 = format!("{:x}", md5::compute(ha1_source.as_bytes()));

        if algorithm == "MD5-SESS" {
            let session_source = format!("{}:{}:{}", ha1, challenge.nonce, cnonce);
            ha1 = format!("{:x}", md5::compute(session_source.as_bytes()));
        }

        let body_hash = if qop_token.as_deref() == Some("auth-int") {
            let data = body.unwrap_or("");
            Some(format!("{:x}", md5::compute(data.as_bytes())))
        } else {
            None
        };

        let ha2_input = if let Some(ref hash) = body_hash {
            format!("{}:{}:{}", method.as_str(), uri, hash)
        } else {
            format!("{}:{}", method.as_str(), uri)
        };
        let ha2 = format!("{:x}", md5::compute(ha2_input.as_bytes()));

        let response_hash = if let Some(ref qop) = qop_token {
            format!(
                "{:x}",
                md5::compute(
                    format!(
                        "{}:{}:{}:{}:{}:{}",
                        ha1, challenge.nonce, nc, cnonce, qop, ha2
                    )
                    .as_bytes()
                )
            )
        } else {
            format!(
                "{:x}",
                md5::compute(format!("{}:{}:{}", ha1, challenge.nonce, ha2).as_bytes())
            )
        };

        let mut header_value = format!(
            "Digest username=\"{}\", realm=\"{}\", nonce=\"{}\", uri=\"{}\", response=\"{}\"",
            escape_quotes(&self.username),
            escape_quotes(&challenge.realm),
            escape_quotes(&challenge.nonce),
            escape_quotes(uri),
            response_hash
        );

        header_value.push_str(&format!(", algorithm={}", algorithm));

        if let Some(ref qop) = qop_token {
            header_value.push_str(&format!(", qop={}, nc={}, cnonce=\"{}\"", qop, nc, cnonce));
        }

        if let Some(ref opaque) = challenge.opaque {
            header_value.push_str(&format!(", opaque=\"{}\"", escape_quotes(opaque)));
        }

        Ok(header_value)
    }

    async fn put_resource(
        &self,
        target: &Url,
        ics: &str,
        etag: Option<&str>,
        create: bool,
    ) -> Result<UploadResult> {
        let mut headers = vec![(
            header::HeaderName::from_static("content-type"),
            "text/calendar; charset=utf-8".to_string(),
        )];

        if create {
            headers.push((
                header::HeaderName::from_static("if-none-match"),
                "*".to_string(),
            ));
        } else if let Some(tag) = etag {
            let normalized_etag = normalize_etag_condition(tag);
            headers.push((
                header::HeaderName::from_static("if-match"),
                normalized_etag,
            ));
        }

        let response = self
            .send_authenticated_request(Method::PUT, target, &headers, Some(ics))
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(anyhow!("CalDAV PUT failed: {status} {text}"));
        }

        let etag = response
            .headers()
            .get(header::ETAG)
            .and_then(|value| value.to_str().ok())
            .map(|value| value.trim().to_string());

        Ok(UploadResult {
            href: target.to_string(),
            etag,
        })
    }
}

fn normalize_etag_condition(etag: &str) -> String {
    let trimmed = etag.trim();
    if trimmed.is_empty() {
        return String::new();
    }

    if trimmed.starts_with("W/") {
        let rest = trimmed.trim_start_matches("W/");
        let strong = normalize_strong_etag(rest);
        format!("W/{}", strong)
    } else {
        normalize_strong_etag(trimmed)
    }
}

fn normalize_strong_etag(value: &str) -> String {
    let trimmed = value.trim();
    let inner = trimmed.trim_matches('"');
    format!("\"{}\"", inner)
}

fn request_uri(url: &Url) -> String {
    let mut uri = url.path().to_string();
    if uri.is_empty() {
        uri.push('/');
    }
    if let Some(query) = url.query() {
        uri.push('?');
        uri.push_str(query);
    }
    uri
}

#[derive(Debug, Clone)]
struct DigestChallenge {
    realm: String,
    nonce: String,
    algorithm: Option<String>,
    qop: Vec<String>,
    opaque: Option<String>,
}

impl DigestChallenge {
    fn parse(header: &str) -> Option<Self> {
        let trimmed = header.trim();
        let rest = if let Some(rest) = trimmed.strip_prefix("Digest") {
            rest.trim_start()
        } else if let Some(rest) = trimmed.strip_prefix("digest") {
            rest.trim_start()
        } else if let Some(rest) = trimmed.strip_prefix("DIGEST") {
            rest.trim_start()
        } else {
            let (_, after) = trimmed.split_once(' ')?;
            after.trim_start()
        };

        let params = parse_challenge_parameters(rest)?;
        let realm = params.get("realm")?.clone();
        let nonce = params.get("nonce")?.clone();
        let algorithm = params.get("algorithm").cloned();
        let qop = params
            .get("qop")
            .map(|value| {
                value
                    .split(',')
                    .map(|part| part.trim().to_string())
                    .filter(|part| !part.is_empty())
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();
        let opaque = params.get("opaque").cloned();

        Some(Self {
            realm,
            nonce,
            algorithm,
            qop,
            opaque,
        })
    }

    fn preferred_qop(&self) -> Option<String> {
        if self.qop.is_empty() {
            return None;
        }
        if let Some(auth) = self
            .qop
            .iter()
            .find(|value| value.eq_ignore_ascii_case("auth"))
        {
            return Some(auth.to_string());
        }
        self.qop.first().map(ToString::to_string)
    }
}

fn parse_challenge_parameters(input: &str) -> Option<HashMap<String, String>> {
    let mut map = HashMap::new();
    let mut i = 0;
    let bytes = input.as_bytes();
    while i < bytes.len() {
        while i < bytes.len() && (bytes[i] == b',' || bytes[i].is_ascii_whitespace()) {
            i += 1;
        }
        if i >= bytes.len() {
            break;
        }
        let key_start = i;
        while i < bytes.len() && bytes[i] != b'=' {
            i += 1;
        }
        if i >= bytes.len() {
            break;
        }
        let key = input[key_start..i].trim().to_ascii_lowercase();
        i += 1; // skip '='
        if i >= bytes.len() {
            break;
        }

        let value;
        if bytes[i] == b'"' {
            i += 1;
            let mut v = String::new();
            while i < bytes.len() {
                let ch = bytes[i] as char;
                i += 1;
                if ch == '"' {
                    break;
                }
                if ch == '\\' && i < bytes.len() {
                    let next = bytes[i] as char;
                    i += 1;
                    v.push(next);
                } else {
                    v.push(ch);
                }
            }
            value = v;
        } else {
            let start = i;
            while i < bytes.len() && bytes[i] != b',' {
                i += 1;
            }
            value = input[start..i].trim().to_string();
        }

        map.insert(key, value);

        while i < bytes.len() && bytes[i].is_ascii_whitespace() {
            i += 1;
        }
        if i < bytes.len() && bytes[i] == b',' {
            i += 1;
        }
    }

    if map.contains_key("realm") && map.contains_key("nonce") {
        Some(map)
    } else {
        None
    }
}

fn escape_quotes(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"")
}

#[derive(Default)]
struct MultiStatusItem {
    href: String,
    etag: Option<String>,
    calendar_data: String,
}

fn parse_multistatus(xml: &str) -> Result<Vec<MultiStatusItem>> {
    let mut reader = Reader::from_str(xml);
    reader.config_mut().trim_text(true);

    let mut buf = Vec::new();
    let mut items = Vec::new();
    let mut current: Option<MultiStatusItem> = None;
    let mut capture: Option<Field> = None;

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(qname)) => match qname.local_name().as_ref() {
                b"response" => {
                    current = Some(MultiStatusItem::default());
                }
                b"href" => {
                    capture = Some(Field::Href);
                }
                b"getetag" => {
                    capture = Some(Field::Etag);
                }
                b"calendar-data" => {
                    capture = Some(Field::CalendarData);
                }
                _ => {}
            },
            Ok(Event::Text(data)) => {
                if let (Some(field), Some(item)) = (capture.as_ref(), current.as_mut()) {
                    let text = reader
                        .decoder()
                        .decode(data.as_ref())
                        .unwrap_or_else(|_| Cow::Borrowed(""))
                        .to_string();
                    match field {
                        Field::Href => item.href = text,
                        Field::Etag => item.etag = Some(text.trim().to_string()),
                        Field::CalendarData => item.calendar_data.push_str(&text),
                    }
                }
            }
            Ok(Event::CData(data)) => {
                if let (Some(field), Some(item)) = (capture.as_ref(), current.as_mut()) {
                    if matches!(field, Field::CalendarData) {
                        let text = String::from_utf8_lossy(data.as_ref());
                        item.calendar_data.push_str(&text);
                    }
                }
            }
            Ok(Event::End(qname)) => match qname.local_name().as_ref() {
                b"response" => {
                    if let Some(item) = current.take() {
                        if !item.href.is_empty() && !item.calendar_data.is_empty() {
                            items.push(item);
                        }
                    }
                }
                b"href" | b"getetag" | b"calendar-data" => {
                    capture = None;
                }
                _ => {}
            },
            Ok(Event::Eof) => break,
            Err(err) => return Err(err.into()),
            _ => {}
        }
        buf.clear();
    }

    Ok(items)
}

enum Field {
    Href,
    Etag,
    CalendarData,
}

fn parse_ical_todo(ics: &str) -> Result<CalDavItem> {
    use ical::parser::ical::IcalParser;

    let mut parser = IcalParser::new(ics.as_bytes());
    let calendar = parser
        .next()
        .transpose()
        .context("failed to parse VCALENDAR")?
        .ok_or_else(|| anyhow!("missing VCALENDAR component"))?;

    let mut todos_iter = calendar.todos.into_iter();
    let todo = todos_iter
        .next()
        .ok_or_else(|| anyhow!("missing VTODO component"))?;

    println!("\n========== Parsed VTODO Properties ==========\n");
    for prop in &todo.properties {
        println!("Property: {} = {:?}", prop.name, prop.value);
        if let Some(params) = &prop.params {
            for (key, values) in params {
                println!("  Param: {} = {:?}", key, values);
            }
        }
    }
    println!("=========================================\n");

    let summary = get_property_value(&todo.properties, "SUMMARY")
        .ok_or_else(|| anyhow!("CalDAV VTODO missing SUMMARY"))?;

    let uid = get_property_value(&todo.properties, "UID")
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    let description = get_property_value(&todo.properties, "DESCRIPTION");
    let status = get_property_value(&todo.properties, "STATUS");
    let percent_complete = get_property_value(&todo.properties, "PERCENT-COMPLETE")
        .and_then(|value| value.parse::<i32>().ok());
    let priority = get_property_value(&todo.properties, "PRIORITY")
        .and_then(|value| value.parse::<i32>().ok());
    let location = get_property_value(&todo.properties, "LOCATION");
    let categories = get_property_value(&todo.properties, "CATEGORIES")
        .map(|value| {
            value
                .split(',')
                .map(|item| item.trim().to_string())
                .filter(|item| !item.is_empty())
                .collect()
        })
        .unwrap_or_default();

    let (start, timezone) = get_datetime_property(&todo.properties, "DTSTART");
    let (due, _) = get_datetime_property(&todo.properties, "DUE");
    let (completed_at, _) = get_datetime_property(&todo.properties, "COMPLETED");
    let (last_modified, _) = get_datetime_property(&todo.properties, "LAST-MODIFIED");
    let recurrence_rule = get_property_value(&todo.properties, "RRULE");

    let reminder_minutes = todo
        .alarms
        .iter()
        .find_map(|alarm| get_property_value(&alarm.properties, "TRIGGER"))
        .and_then(parse_trigger_offset);
    
    // 解析 RELATED-TO 字段（用于子任务）
    let related_to = get_property_value(&todo.properties, "RELATED-TO");

    Ok(CalDavItem {
        uid,
        summary,
        description,
        status,
        percent_complete,
        priority,
        location,
        categories,
        start,
        due,
        completed_at,
        last_modified,
        reminder_minutes,
        timezone,
        recurrence_rule,
        related_to,
    })
}

fn get_property_value(properties: &[ical::property::Property], name: &str) -> Option<String> {
    properties
        .iter()
        .find(|prop| prop.name.eq_ignore_ascii_case(name))
        .and_then(|prop| prop.value.clone())
}

fn get_property_parameter(
    properties: &[ical::property::Property],
    name: &str,
    parameter: &str,
) -> Option<String> {
    properties
        .iter()
        .find(|prop| prop.name.eq_ignore_ascii_case(name))
        .and_then(|prop| prop.params.as_ref())
        .and_then(|params| {
            params.iter().find_map(|(param_name, values)| {
                if param_name.eq_ignore_ascii_case(parameter) {
                    values.first().cloned()
                } else {
                    None
                }
            })
        })
}

fn get_datetime_property(
    properties: &[ical::property::Property],
    name: &str,
) -> (Option<DateTime<Utc>>, Option<String>) {
    let value = match get_property_value(properties, name) {
        Some(value) => value,
        None => return (None, None),
    };
    let timezone = get_property_parameter(properties, name, "TZID");
    
    // 解析时间，如果有 TZID，需要将本地时间转换为 UTC
    let parsed = parse_ical_datetime(&value, timezone.as_deref()).ok();
    (parsed, timezone)
}

fn parse_ical_datetime(value: &str, tzid: Option<&str>) -> Result<DateTime<Utc>> {
    // RFC3339 格式
    if let Ok(dt) = DateTime::parse_from_rfc3339(value) {
        return Ok(dt.with_timezone(&Utc));
    }

    // UTC 时间 (带 Z 后缀)
    if value.ends_with('Z') {
        let trimmed = &value[..value.len() - 1];
        let naive = NaiveDateTime::parse_from_str(trimmed, "%Y%m%dT%H%M%S")
            .or_else(|_| NaiveDateTime::parse_from_str(trimmed, "%Y%m%dT%H%M"))
            .context("failed to parse UTC datetime")?;
        return Ok(DateTime::<Utc>::from_naive_utc_and_offset(naive, Utc));
    }

    // 纯日期格式
    if value.len() == 8 {
        let date =
            NaiveDate::parse_from_str(value, "%Y%m%d").context("failed to parse date value")?;
        let naive = NaiveDateTime::new(date, NaiveTime::from_hms_opt(0, 0, 0).unwrap());
        return Ok(DateTime::<Utc>::from_naive_utc_and_offset(naive, Utc));
    }

    // 本地时间格式
    let naive = NaiveDateTime::parse_from_str(value, "%Y%m%dT%H%M%S")
        .or_else(|_| NaiveDateTime::parse_from_str(value, "%Y%m%dT%H%M"))
        .context("failed to parse datetime")?;
    
    // 如果有 TZID，将本地时间转换为 UTC
    if let Some(tz_str) = tzid {
        if let Ok(tz) = tz_str.parse::<Tz>() {
            // 将本地时间转换为该时区的时间，再转换为 UTC
            if let Some(local_dt) = tz.from_local_datetime(&naive).earliest() {
                return Ok(local_dt.with_timezone(&Utc));
            }
        }
    }
    
    // 没有时区信息，当作 UTC 处理
    Ok(DateTime::<Utc>::from_naive_utc_and_offset(naive, Utc))
}

fn parse_trigger_offset(value: String) -> Option<i32> {
    let trimmed = value.trim();
    if !trimmed.starts_with('-') {
        return None;
    }

    let trimmed = trimmed.trim_start_matches('-');
    if let Some(minutes) = trimmed.strip_prefix("PT").and_then(|v| v.strip_suffix('M')) {
        return minutes.parse::<i32>().ok();
    }

    if let Some(hours) = trimmed.strip_prefix("PT").and_then(|v| v.strip_suffix('H')) {
        return hours.parse::<i32>().ok().map(|h| h * 60);
    }

    None
}
