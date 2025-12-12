use tauri::ipc::Invoke;

/// 获取所有命令的处理器
///
/// 封装 Tauri 的 generate_handler! 宏，统一管理所有命令注册
pub fn get_handler() -> impl Fn(Invoke<tauri::Wry>) -> bool + Send + Sync + 'static {
    tauri::generate_handler![
        // Todo Feature Commands
        crate::features::todo::api::commands::list_todos,
        crate::features::todo::api::commands::create_todo,
        crate::features::todo::api::commands::update_todo,
        crate::features::todo::api::commands::delete_todo,
        crate::features::todo::api::commands::update_todo_details,
        crate::features::todo::api::commands::get_subtasks,
        crate::features::todo::api::commands::update_todo_parent,
        crate::features::todo::api::commands::reorder_todo,
        // CalDAV Commands
        crate::features::todo::sync::caldav_commands::get_caldav_status,
        crate::features::todo::sync::caldav_commands::save_caldav_config,
        crate::features::todo::sync::caldav_commands::clear_caldav_config,
        crate::features::todo::sync::caldav_commands::sync_caldav_now,
        crate::features::todo::sync::caldav_commands::get_caldav_sync_interval,
        crate::features::todo::sync::caldav_commands::set_caldav_sync_interval,
        // Settings Feature Commands
        crate::features::settings::api::commands::get_theme_preference,
        crate::features::settings::api::commands::set_theme_preference,
        // Tag Feature Commands
        crate::features::tag::api::commands::tag_get_all,
        crate::features::tag::api::commands::tag_create,
        crate::features::tag::api::commands::tag_update,
        crate::features::tag::api::commands::tag_delete,
        crate::features::tag::api::commands::tag_get_for_task,
        crate::features::tag::api::commands::tag_set_for_task,
        crate::features::tag::api::commands::tag_get_for_session,
        crate::features::tag::api::commands::tag_set_for_session,
        // Pomodoro Feature Commands
        crate::features::pomodoro::api::commands::pomodoro_start,
        crate::features::pomodoro::api::commands::pomodoro_pause,
        crate::features::pomodoro::api::commands::pomodoro_resume,
        crate::features::pomodoro::api::commands::pomodoro_skip,
        crate::features::pomodoro::api::commands::pomodoro_stop,
        crate::features::pomodoro::api::commands::pomodoro_status,
        crate::features::pomodoro::api::commands::pomodoro_get_config,
        crate::features::pomodoro::api::commands::pomodoro_set_config,
        crate::features::pomodoro::api::commands::pomodoro_list_sessions,
        crate::features::pomodoro::api::commands::pomodoro_delete_session,
        crate::features::pomodoro::api::commands::pomodoro_stats,
        // Pomodoro Session Management Commands
        crate::features::pomodoro::api::commands::pomodoro_create_session,
        crate::features::pomodoro::api::commands::pomodoro_get_session,
        crate::features::pomodoro::api::commands::pomodoro_list_all_sessions,
        crate::features::pomodoro::api::commands::pomodoro_update_session_note,
        crate::features::pomodoro::api::commands::pomodoro_archive_session,
        crate::features::pomodoro::api::commands::pomodoro_delete_session_cascade,
        crate::features::pomodoro::api::commands::pomodoro_get_active_session,
        crate::features::pomodoro::api::commands::pomodoro_get_or_create_active_session,
        crate::features::pomodoro::api::commands::pomodoro_list_session_records,
        crate::features::pomodoro::api::commands::pomodoro_generate_session_title,
        crate::features::pomodoro::api::commands::pomodoro_save_adjusted_times,
        crate::features::pomodoro::api::commands::pomodoro_get_adjusted_times,
        // WebServer Commands (Desktop only)
        #[cfg(not(any(target_os = "android", target_os = "ios")))]
        crate::infrastructure::webserver::api::commands::start_web_server,
        #[cfg(not(any(target_os = "android", target_os = "ios")))]
        crate::infrastructure::webserver::api::commands::stop_web_server,
        #[cfg(not(any(target_os = "android", target_os = "ios")))]
        crate::infrastructure::webserver::api::commands::web_server_status,
        // Pet Feature Commands
        #[cfg(target_os = "windows")]
        crate::features::pet::commands::pet_start,
        #[cfg(target_os = "windows")]
        crate::features::pet::commands::pet_stop,
        #[cfg(target_os = "windows")]
        crate::features::pet::commands::pet_status,
        #[cfg(target_os = "windows")]
        crate::features::pet::commands::get_pet_auto_start,
        #[cfg(target_os = "windows")]
        crate::features::pet::commands::set_pet_auto_start,
    ]
}
