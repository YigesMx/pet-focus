pub mod setting;
pub mod todo;

pub mod prelude {
    pub use super::setting::Entity as Setting;
    pub use super::todo::Entity as Todo;
}
