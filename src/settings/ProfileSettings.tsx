import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  User,
  Shield,
  ShieldCheck,
  IdCard,
  Lock,
  KeyRound,
  Laptop,
  Pencil,
  ChevronRight,
  X,
  Smartphone,
  QrCode,
  GraduationCap,
  CheckCircle2,
  Check
} from "lucide-react";
import { getMyProfile, updateMyProfile, changePassword, type AuthSession } from "../api";
import { messageOf } from "../lib/errors";
import "./profile-settings.css";

const roles: Record<string, string> = {
  ADMIN: "Quản trị viên",
  TEACHER: "Giáo viên",
  STUDENT: "Học sinh",
};

const statuses: Record<string, string> = {
  ACTIVE: "Hoạt động",
  LOCKED: "Đã khóa",
  INACTIVE: "Tạm ngưng",
  ARCHIVED: "Đã xóa",
};

const show = (value: unknown) =>
  value === null || value === undefined || value === "" ? "Chưa cập nhật" : String(value);

const date = (value: string | null) =>
  value ? new Intl.DateTimeFormat("vi-VN").format(new Date(value)) : "Chưa cập nhật";

export function ProfileSettings({ session }: { session: AuthSession }) {
  const client = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [twoFactorOpen, setTwoFactorOpen] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [devicesOpen, setDevicesOpen] = useState(false);

  // Form states for profile edit
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["my-profile", session.accessToken],
    queryFn: () => getMyProfile(session),
  });
  const profile = query.data;

  useEffect(() => {
    if (profile) {
      setFullName(profile.fullName);
      setEmail(profile.email);
      setPhone(profile.phone ?? "");
      setDateOfBirth(profile.dateOfBirth ?? "");
      setGender(profile.gender ?? "");
      setAvatarUrl(profile.avatarUrl);
    }
  }, [profile]);

  const save = useMutation({
    mutationFn: () =>
      updateMyProfile(session, {
        fullName,
        email,
        phone,
        dateOfBirth: dateOfBirth || null,
        gender,
        avatarUrl,
      }),
    onSuccess: (data) => {
      client.setQueryData(["my-profile", session.accessToken], data);
      setEditing(false);
    },
  });

  const chooseAvatar = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Vui lòng chọn tệp ảnh.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert("Ảnh đại diện tối đa 2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAvatarUrl(String(reader.result));
    reader.readAsDataURL(file);
  };

  if (query.isLoading) {
    return <div className="self-profile-state">Đang tải thông tin cá nhân…</div>;
  }

  if (query.isError || !profile) {
    return (
      <div className="self-profile-state error">
        <span>Không thể tải thông tin cá nhân.</span>
        <button onClick={() => void query.refetch()}>Thử lại</button>
      </div>
    );
  }

  const initials = profile.fullName
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((x) => x[0])
    .join("")
    .toUpperCase();

  const roleLabel = roles[profile.roleCode] ?? profile.roleCode;

  return (
    <section className="self-profile-page">
      {/* Page Header */}
      <header className="self-profile-header">
        <p className="self-profile-eyebrow">CÀI ĐẶT</p>
        <h1 className="self-profile-title">Thông tin cá nhân</h1>
        <span className="self-profile-subtitle">
          Thông tin hồ sơ và tài khoản của bạn trong hệ thống.
        </span>
      </header>

      {/* Hero Profile Card */}
      <section className="self-profile-hero">
        <div className="self-avatar-wrapper">
          <div className="self-avatar">
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt="Ảnh đại diện" />
            ) : (
              initials || "?"
            )}
          </div>
          <div className="self-avatar-badge" title="Tài khoản đã xác thực">
            <Check size={12} className="self-badge-icon" />
          </div>
        </div>
        <div className="self-hero-info">
          <h2>{profile.fullName}</h2>
          <span className="self-role-badge">{roleLabel}</span>
        </div>
        <div className="self-hero-actions">
          <button className="btn-primary-profile" onClick={() => setEditing(true)}>
            <Pencil size={15} />
            <span>Chỉnh sửa thông tin</span>
          </button>
          <button className="btn-secondary-profile" onClick={() => setChangingPassword(true)}>
            <Lock size={15} />
            <span>Đổi mật khẩu</span>
          </button>
        </div>
      </section>

      {save.isError && (
        <div className="self-profile-state error">
          <span>{save.error instanceof Error ? save.error.message : "Không thể lưu thay đổi"}</span>
        </div>
      )}

      {/* 2x2 Grid of Detail Cards */}
      <div className="self-profile-grid">
        {/* Card 1: Thông tin cá nhân */}
        <section className="self-profile-block">
          <div className="self-block-header">
            <div className="self-block-icon">
              <User size={18} />
            </div>
            <h3>Thông tin cá nhân</h3>
          </div>
          <dl className="self-block-list">
            <Row label="Họ và tên" value={profile.fullName} />
            <Row label="Ngày sinh" value={show(profile.dateOfBirth)} />
            <Row label="Giới tính" value={show(profile.gender)} />
            <Row label="Email" value={profile.email} />
            <Row label="Số điện thoại" value={show(profile.phone)} />
          </dl>
        </section>

        {/* Card 2: Thông tin quản trị / công tác / học tập */}
        {profile.roleCode === "ADMIN" ? (
          <section className="self-profile-block">
            <div className="self-block-header">
              <div className="self-block-icon">
                <Shield size={18} />
              </div>
              <h3>Thông tin quản trị</h3>
            </div>
            <dl className="self-block-list">
              <Row label="Mã Admin" value={profile.code} />
              <Row label="Vai trò" value="System Admin" />
              <Row label="Nhóm quyền" value={profile.permissionGroup || "Quản trị hệ thống"} />
              <Row label="Đơn vị" value={show(profile.department)} />
            </dl>
          </section>
        ) : profile.roleCode === "TEACHER" ? (
          <section className="self-profile-block">
            <div className="self-block-header">
              <div className="self-block-icon">
                <GraduationCap size={18} />
              </div>
              <h3>Thông tin công tác</h3>
            </div>
            <dl className="self-block-list">
              <Row label="Mã giáo viên" value={profile.code} />
              <Row label="Bộ môn" value={show(profile.subject)} />
              <Row label="Lớp phụ trách" value={profile.classes.join(", ") || "Chưa phân công"} />
              <Row label="Năm học" value={show(profile.academicYear)} />
            </dl>
          </section>
        ) : (
          <section className="self-profile-block">
            <div className="self-block-header">
              <div className="self-block-icon">
                <GraduationCap size={18} />
              </div>
              <h3>Thông tin học tập</h3>
            </div>
            <dl className="self-block-list">
              <Row label="Mã học sinh" value={profile.code} />
              <Row label="Khối" value={show(profile.grade)} />
              <Row label="Lớp" value={profile.classes.join(", ") || "Chưa phân lớp"} />
              <Row label="Năm học" value={show(profile.academicYear)} />
              <Row label="Trạng thái học tập" value="Đang học" />
            </dl>
          </section>
        )}

        {/* Card 3: Thông tin tài khoản */}
        <section className="self-profile-block">
          <div className="self-block-header">
            <div className="self-block-icon">
              <IdCard size={18} />
            </div>
            <h3>Thông tin tài khoản</h3>
          </div>
          <dl className="self-block-list">
            <Row label="Tên đăng nhập" value={profile.username} />
            <Row label="Vai trò" value={roles[profile.roleCode] ?? profile.roleCode} />
            <Row
              label="Trạng thái"
              value={
                <span className="status-badge-active">
                  <span className="status-badge-dot" />
                  {statuses[profile.status] ?? profile.status}
                </span>
              }
            />
            <Row label="Ngày tạo" value={date(profile.createdAt)} />
            <Row label="Lần đăng nhập gần nhất" value={date(profile.lastLoginAt)} />
          </dl>
        </section>

        {/* Card 4: Bảo mật */}
        <section className="self-profile-block">
          <div className="self-block-header">
            <div className="self-block-icon">
              <Lock size={18} />
            </div>
            <h3>Bảo mật</h3>
          </div>
          <div className="self-security-list">
            <div className="self-security-row">
              <div className="security-icon-wrap">
                <KeyRound size={18} />
              </div>
              <div className="security-info">
                <h4>Mật khẩu</h4>
                <p>Cập nhật lần cuối {date(profile.createdAt)}</p>
              </div>
              <button className="security-action-link" onClick={() => setChangingPassword(true)}>
                <span>Đổi mật khẩu</span>
                <ChevronRight size={14} />
              </button>
            </div>

            <div className="self-security-row">
              <div className="security-icon-wrap">
                <ShieldCheck size={18} />
              </div>
              <div className="security-info">
                <h4>Xác thực 2 bước</h4>
                <p>{twoFactorEnabled ? "Đã kích hoạt" : "Chưa kích hoạt"}</p>
              </div>
              <button className="security-action-link" onClick={() => setTwoFactorOpen(true)}>
                <span>{twoFactorEnabled ? "Cấu hình" : "Bật"}</span>
                <ChevronRight size={14} />
              </button>
            </div>

            <div className="self-security-row">
              <div className="security-icon-wrap">
                <Laptop size={18} />
              </div>
              <div className="security-info">
                <h4>Thiết bị đăng nhập</h4>
                <p>1 thiết bị đang hoạt động</p>
              </div>
              <button className="security-action-link" onClick={() => setDevicesOpen(true)}>
                <span>Xem chi tiết</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Modal 1: Chỉnh sửa thông tin cá nhân */}
      {editing && (
        <div
          className="self-profile-modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setEditing(false);
          }}
        >
          <div className="self-profile-modal-card">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                save.mutate();
              }}
            >
              <header className="self-modal-head">
                <h2>Chỉnh sửa thông tin cá nhân</h2>
                <button
                  type="button"
                  className="self-modal-close-btn"
                  onClick={() => setEditing(false)}
                >
                  <X size={18} />
                </button>
              </header>

              <div className="self-modal-body">
                <div className="self-avatar-picker">
                  <div className="self-picker-preview">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Ảnh đại diện mới" />
                    ) : (
                      <span>{initials || "?"}</span>
                    )}
                  </div>
                  <div className="self-picker-actions">
                    <b>Ảnh đại diện</b>
                    <small>Định dạng PNG, JPG hoặc WebP. Tối đa 2MB.</small>
                    <label className="self-picker-btn">
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(e) => chooseAvatar(e.target.files?.[0])}
                      />
                      Thay ảnh
                    </label>
                  </div>
                </div>

                <label>
                  Họ và tên
                  <input
                    required
                    maxLength={120}
                    value={fullName}
                    placeholder="Nhập họ và tên"
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </label>

                <label>
                  Email
                  <input
                    type="email"
                    required
                    value={email}
                    placeholder="name@math10.vn"
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>

                <label>
                  Số điện thoại
                  <input
                    maxLength={30}
                    value={phone}
                    placeholder="Nhập số điện thoại"
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </label>

                <label>
                  Ngày sinh
                  <input
                    type="date"
                    value={dateOfBirth}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                  />
                </label>

                <label>
                  Giới tính
                  <select value={gender} onChange={(e) => setGender(e.target.value)}>
                    <option value="">Chưa cập nhật</option>
                    <option value="Nam">Nam</option>
                    <option value="Nữ">Nữ</option>
                    <option value="Khác">Khác</option>
                  </select>
                </label>
              </div>

              <footer className="self-modal-footer">
                <button
                  type="button"
                  className="btn-cancel-modal"
                  onClick={() => setEditing(false)}
                >
                  Hủy
                </button>
                <button type="submit" className="btn-submit-modal" disabled={save.isPending}>
                  {save.isPending ? "Đang lưu…" : "Lưu thay đổi"}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Đổi mật khẩu */}
      {changingPassword && (
        <ChangePasswordModal session={session} onClose={() => setChangingPassword(false)} />
      )}

      {/* Modal 3: Xác thực 2 bước */}
      {twoFactorOpen && (
        <TwoFactorModal
          enabled={twoFactorEnabled}
          onToggle={(val) => setTwoFactorEnabled(val)}
          onClose={() => setTwoFactorOpen(false)}
        />
      )}

      {/* Modal 4: Thiết bị đăng nhập */}
      {devicesOpen && (
        <DevicesModal onClose={() => setDevicesOpen(false)} />
      )}
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function ChangePasswordModal({
  session,
  onClose,
}: {
  session: AuthSession;
  onClose: () => void;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await changePassword(session, currentPassword, newPassword, confirmPassword);
      setSuccess(true);
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="self-profile-modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="self-profile-modal-card">
        <header className="self-modal-head">
          <h2>Đổi mật khẩu</h2>
          <button type="button" className="self-modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        {success ? (
          <div className="self-modal-body">
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                gap: "12px",
                padding: "24px 16px",
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: "50%",
                  background: "#dcfce7",
                  color: "#16a34a",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <CheckCircle2 size={32} />
              </div>
              <b style={{ fontSize: 16, color: "#0f172a" }}>Đổi mật khẩu thành công!</b>
              <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
                Mật khẩu của bạn đã được cập nhật. Vui lòng sử dụng mật khẩu mới ở các lần đăng
                nhập tiếp theo.
              </p>
            </div>
            <div className="self-modal-footer" style={{ justifyContent: "center" }}>
              <button className="btn-submit-modal" onClick={onClose}>
                Hoàn tất
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="self-modal-body">
              {error && (
                <div className="self-profile-state error" style={{ margin: 0 }}>
                  <span>{error}</span>
                </div>
              )}
              <label>
                Mật khẩu hiện tại
                <input
                  type="password"
                  required
                  placeholder="Nhập mật khẩu đang dùng"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </label>
              <label>
                Mật khẩu mới
                <input
                  type="password"
                  required
                  minLength={8}
                  placeholder="Tối thiểu 8 ký tự"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </label>
              <label>
                Xác nhận mật khẩu mới
                <input
                  type="password"
                  required
                  minLength={8}
                  placeholder="Nhập lại mật khẩu mới"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </label>
            </div>
            <footer className="self-modal-footer">
              <button type="button" className="btn-cancel-modal" onClick={onClose}>
                Hủy
              </button>
              <button type="submit" className="btn-submit-modal" disabled={busy}>
                {busy ? "Đang lưu…" : "Đổi mật khẩu"}
              </button>
            </footer>
          </form>
        )}
      </div>
    </div>
  );
}

function TwoFactorModal({
  enabled,
  onToggle,
  onClose,
}: {
  enabled: boolean;
  onToggle: (val: boolean) => void;
  onClose: () => void;
}) {
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"intro" | "setup">(enabled ? "intro" : "setup");

  return (
    <div
      className="self-profile-modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="self-profile-modal-card">
        <header className="self-modal-head">
          <h2>Xác thực hai bước (2FA)</h2>
          <button type="button" className="self-modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div className="self-modal-body">
          {enabled ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "14px 16px",
                  borderRadius: 10,
                  background: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                }}
              >
                <ShieldCheck size={24} className="text-[#16a34a]" />
                <div>
                  <b style={{ color: "#166534", fontSize: 14 }}>2FA đang được kích hoạt</b>
                  <p style={{ margin: "2px 0 0", color: "#15803d", fontSize: 12 }}>
                    Tài khoản của bạn được bảo vệ qua ứng dụng xác thực OTP.
                  </p>
                </div>
              </div>
              <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
                Nếu bạn muốn tắt xác thực 2 bước, tài khoản sẽ giảm độ an toàn trước các nguy cơ tấn
                công mật khẩu.
              </p>
            </div>
          ) : step === "intro" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <p style={{ fontSize: 13.5, color: "#334155", margin: 0 }}>
                Xác thực 2 bước tăng cường bảo mật cho tài khoản quản trị của bạn bằng cách yêu cầu mã
                xác thực 6 số từ ứng dụng trên điện thoại mỗi khi đăng nhập.
              </p>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 14px",
                  borderRadius: 10,
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                }}
              >
                <Smartphone size={20} className="text-[#16845b]" />
                <span style={{ fontSize: 13, color: "#475569" }}>
                  Hỗ trợ Google Authenticator, Microsoft Authenticator hoặc Authy.
                </span>
              </div>
            </div>
          ) : (
            <div className="two-factor-box">
              <div className="qr-code-placeholder">
                <QrCode size={48} />
                <span style={{ fontSize: 11, fontWeight: 700 }}>MATH10 AUTH</span>
              </div>
              <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>
                Quét mã QR bằng ứng dụng Authenticator, sau đó nhập mã 6 số để xác nhận:
              </p>
              <input
                type="text"
                maxLength={6}
                placeholder="000 000"
                style={{
                  width: 160,
                  textAlign: "center",
                  letterSpacing: 4,
                  fontSize: 18,
                  fontWeight: 700,
                  height: 42,
                }}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              />
            </div>
          )}
        </div>

        <footer className="self-modal-footer">
          <button type="button" className="btn-cancel-modal" onClick={onClose}>
            Đóng
          </button>
          {enabled ? (
            <button
              type="button"
              className="btn-cancel-modal"
              style={{ color: "#dc2626", borderColor: "#fca5a5" }}
              onClick={() => {
                onToggle(false);
                onClose();
              }}
            >
              Tắt 2FA
            </button>
          ) : step === "intro" ? (
            <button
              type="button"
              className="btn-submit-modal"
              onClick={() => setStep("setup")}
            >
              Tiếp tục thiết lập
            </button>
          ) : (
            <button
              type="button"
              className="btn-submit-modal"
              disabled={code.length < 6}
              onClick={() => {
                onToggle(true);
                onClose();
              }}
            >
              Kích hoạt ngay
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

function DevicesModal({ onClose }: { onClose: () => void }) {
  const [loggedOutOthers, setLoggedOutOthers] = useState(false);

  return (
    <div
      className="self-profile-modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="self-profile-modal-card">
        <header className="self-modal-head">
          <h2>Thiết bị đăng nhập</h2>
          <button type="button" className="self-modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div className="self-modal-body">
          <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
            Danh sách các thiết bị hiện đang đăng nhập vào tài khoản của bạn:
          </p>

          <div className="device-item current">
            <div className="device-item-icon">
              <Laptop size={20} />
            </div>
            <div className="device-item-details">
              <b>Chrome trên Windows 11</b>
              <span>Hà Nội, Việt Nam · IP: 118.70.190.45</span>
            </div>
            <span className="device-badge-current">Thiết bị hiện tại</span>
          </div>

          {!loggedOutOthers && (
            <div className="device-item">
              <div className="device-item-icon">
                <Smartphone size={20} />
              </div>
              <div className="device-item-details">
                <b>Safari trên iOS (iPhone 15)</b>
                <span>Hồ Chí Minh, Việt Nam · Đăng nhập 2 ngày trước</span>
              </div>
            </div>
          )}
        </div>

        <footer className="self-modal-footer">
          {!loggedOutOthers ? (
            <button
              type="button"
              className="btn-cancel-modal"
              style={{ color: "#dc2626", borderColor: "#fca5a5" }}
              onClick={() => setLoggedOutOthers(true)}
            >
              Đăng xuất các thiết bị khác
            </button>
          ) : (
            <span style={{ fontSize: 12, color: "#16845b", fontWeight: 600 }}>
              Đã đăng xuất các thiết bị khác.
            </span>
          )}
          <button type="button" className="btn-cancel-modal" onClick={onClose}>
            Đóng
          </button>
        </footer>
      </div>
    </div>
  );
}


