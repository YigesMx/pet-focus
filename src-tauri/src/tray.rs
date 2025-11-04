use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, Wry,
};

use crate::AppState;

pub fn create_tray(app: &AppHandle<Wry>) -> tauri::Result<()> {
    let toggle_i = MenuItem::with_id(app, "toggle", "显示/隐藏窗口", true, None::<&str>)?;
    let separator_1 = PredefinedMenuItem::separator(app)?;
    let start_server_i = MenuItem::with_id(app, "start_server", "启动 API 服务器", true, None::<&str>)?;
    let stop_server_i = MenuItem::with_id(app, "stop_server", "停止 API 服务器", true, None::<&str>)?;
    let separator_2 = PredefinedMenuItem::separator(app)?;
    let quit_i = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;

    let menu = Menu::with_items(
        app,
        &[
            &toggle_i,
            &separator_1,
            &start_server_i,
            &stop_server_i,
            &separator_2,
            &quit_i,
        ],
    )?;


    let _tray = TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .show_menu_on_left_click(false)  // 左键不显示菜单
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .on_menu_event(move |app, event| {
            match event.id.as_ref() {
                "toggle" => {
                    if let Some(window) = app.get_webview_window("main") {
                        if window.is_visible().unwrap_or(false) {
                            let _ = window.hide();
                        } else {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                }
                "start_server" => {
                    let app_handle = app.clone();
                    tauri::async_runtime::spawn(async move {
                        if let Some(state) = app_handle.try_state::<AppState>() {
                            match state
                                .web_server()
                                .start(state.db().clone(), app_handle.clone(), None)
                                .await
                            {
                                Ok(_) => {
                                    println!("Web server started successfully");
                                }
                                Err(e) => {
                                    eprintln!("Failed to start web server: {}", e);
                                }
                            }
                        }
                    });
                }
                "stop_server" => {
                    let app_handle = app.clone();
                    tauri::async_runtime::spawn(async move {
                        if let Some(state) = app_handle.try_state::<AppState>() {
                            match state.web_server().stop().await {
                                Ok(_) => {
                                    println!("Web server stopped successfully");
                                }
                                Err(e) => {
                                    eprintln!("Failed to stop web server: {}", e);
                                }
                            }
                        }
                    });
                }
                "quit" => {
                    // 先停止 web server
                    let app_handle = app.clone();
                    tauri::async_runtime::spawn(async move {
                        if let Some(state) = app_handle.try_state::<AppState>() {
                            let _ = state.web_server().stop().await;
                        }
                        // 退出应用
                        app_handle.exit(0);
                    });
                }
                _ => {}
            }
        })
        .build(app)?;

    Ok(())
}

