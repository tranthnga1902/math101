-- Bảng refresh_tokens có từ baseline nhưng chưa service nào dùng, nên chưa ai cần index.
-- Từ nay mỗi lần đăng nhập ghi một dòng, và khi phát hiện token bị dùng lại thì phải
-- thu hồi toàn bộ phiên của một người — cả hai đều tra theo user_id.
create index if not exists idx_refresh_tokens_user on refresh_tokens (user_id);

-- Dọn phiên hết hạn chạy theo expires_at.
create index if not exists idx_refresh_tokens_expires on refresh_tokens (expires_at);
