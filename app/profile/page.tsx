"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState("");

  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState("");

  const [setup2fa, setSetup2fa] = useState<any>(null);
  const [totpCode, setTotpCode] = useState("");
  const [twoFaMsg, setTwoFaMsg] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const [meRes, sessionsRes] = await Promise.all([
        fetch("/api/auth/me"),
        fetch("/api/auth/sessions")
      ]);

      if (!meRes.ok) throw new Error("Unauthorized");
      
      const meData = await meRes.json();
      setUser(meData.user);
      setEditNameValue(meData.user.name || "");

      if (sessionsRes.ok) {
        const sessionsData = await sessionsRes.json();
        setSessions(sessionsData.sessions || []);
      }
    } catch (err) {
      router.push("/login");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg("");
    const res = await fetch("/api/auth/password", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    if (res.ok) {
      setPasswordMsg("Password updated successfully");
      setCurrentPassword("");
      setNewPassword("");
      fetchData(); // Refresh sessions since others are invalidated
    } else {
      const data = await res.json();
      setPasswordMsg(data.error || "Failed to update password");
    }
  };

  const handleSaveName = async () => {
    const res = await fetch("/api/auth/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editNameValue }),
    });
    if (res.ok) {
      const data = await res.json();
      setUser((prev: any) => ({ ...prev, name: data.user.name }));
      setIsEditingName(false);
    }
  };

  const handleRevokeSession = async (id: string) => {
    const res = await fetch(`/api/auth/sessions/${id}`, { method: "DELETE" });
    if (res.ok) {
      setSessions((prev) => prev.filter((s) => s.id !== id));
    }
  };

  const handleDeleteAccount = async () => {
    if (confirm("Are you sure you want to delete your account? This action cannot be undone.")) {
      const res = await fetch("/api/auth/me", { method: "DELETE" });
      if (res.ok) {
        router.push("/login");
      } else {
        alert("Failed to delete account");
      }
    }
  };

  const handleSetup2FA = async () => {
    const res = await fetch("/api/auth/2fa/setup");
    if (res.ok) {
      const data = await res.json();
      setSetup2fa(data);
    }
  };

  const handleVerify2FA = async () => {
    const res = await fetch("/api/auth/2fa/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ totpCode }),
    });
    if (res.ok) {
      setTwoFaMsg("2FA enabled successfully");
      setSetup2fa(null);
      fetchData();
    } else {
      setTwoFaMsg("Invalid code");
    }
  };

  const handleDisable2FA = async () => {
    const password = prompt("Enter password to disable 2FA:");
    const code = prompt("Enter current authenticator code:");
    if (!password || !code) return;

    const res = await fetch("/api/auth/2fa/disable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password, totpCode: code }),
    });
    if (res.ok) {
      setTwoFaMsg("2FA disabled successfully");
      fetchData();
    } else {
      setTwoFaMsg("Failed to disable 2FA");
    }
  };

  const getInitials = (name?: string, email?: string) => {
    if (name) {
      const parts = name.trim().split(" ");
      if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
      return (parts[0][0] || "U").toUpperCase();
    }
    if (email) return email.substring(0, 2).toUpperCase();
    return "U";
  };

  if (loading) return <div className="p-xl font-body text-body text-on-surface-variant animate-pulse">Loading profile...</div>;

  return (
    <div className="flex flex-col gap-xl max-w-4xl">
      <div>
        <h1 className="font-page-title text-page-title text-on-surface mb-xs">Profile Settings</h1>
        <p className="font-body text-body text-on-surface-variant">Manage your personal information, security preferences, and active sessions.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
        {/* Personal Info Card */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-lg flex flex-col shadow-sm">
          <h2 className="font-section-title text-section-title text-on-surface mb-lg">Personal Information</h2>
          
          <div className="flex items-center gap-lg mb-xl">
            <div className="w-16 h-16 bg-surface-container-high rounded-full flex items-center justify-center text-primary font-display text-2xl border border-outline-variant shrink-0">
              {getInitials(user?.name, user?.email)}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                {isEditingName ? (
                  <div className="flex items-center gap-sm w-full">
                    <input 
                      type="text" 
                      value={editNameValue} 
                      onChange={(e) => setEditNameValue(e.target.value)}
                      className="flex-1 bg-surface-container-low border border-outline-variant rounded-md px-sm py-xs text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm"
                    />
                    <button onClick={handleSaveName} className="text-xs bg-primary text-on-primary px-sm py-xs rounded hover:bg-inverse-surface transition-colors font-medium">Save</button>
                    <button onClick={() => { setIsEditingName(false); setEditNameValue(user?.name || ""); }} className="text-xs bg-surface-container-high text-on-surface px-sm py-xs rounded border border-outline-variant hover:bg-surface-container transition-colors font-medium">Cancel</button>
                  </div>
                ) : (
                  <>
                    <div>
                      <p className="font-bold text-on-surface text-[18px]">{user?.name || "N/A"}</p>
                      <p className="text-sm text-on-surface-variant">{user?.email}</p>
                    </div>
                    <button onClick={() => setIsEditingName(true)} className="text-sm text-primary font-medium hover:underline flex items-center gap-xs">
                      <span className="material-symbols-outlined text-[16px]">edit</span> Edit
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
          
          <div className="mt-auto border-t border-outline-variant pt-md">
            <p className="text-sm text-on-surface-variant mb-md"><span className="font-medium text-on-surface">Role:</span> {user?.role}</p>
            <button 
              onClick={handleLogout}
              className="bg-surface-container-high border border-outline-variant text-on-surface px-md py-sm rounded-lg hover:bg-surface-container transition-colors font-button-label text-button-label flex items-center gap-sm justify-center w-full"
            >
              <span className="material-symbols-outlined text-[18px]">logout</span>
              Sign out
            </button>
          </div>
        </div>

        {/* Security Card */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-lg flex flex-col shadow-sm">
          <h2 className="font-section-title text-section-title text-on-surface mb-lg">Security Settings</h2>
          
          <div className="mb-md pb-md border-b border-outline-variant">
            <h3 className="font-status text-status text-on-surface mb-xs">TWO-FACTOR AUTHENTICATION</h3>
            {user?.totpEnabled ? (
              <div className="flex items-center justify-between">
                <span className="text-sm text-success flex items-center gap-xs"><span className="material-symbols-outlined text-[16px]">check_circle</span> Enabled</span>
                <button onClick={handleDisable2FA} className="text-xs bg-error-container text-error px-sm py-xs rounded">Disable</button>
              </div>
            ) : setup2fa ? (
              <div className="flex flex-col gap-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={setup2fa.qrCodeUrl} alt="QR Code" className="w-32 h-32 bg-white p-1 rounded" />
                <input 
                  type="text" value={totpCode} onChange={e => setTotpCode(e.target.value)} 
                  placeholder="123456" className="w-full bg-surface-container-low border border-outline-variant rounded px-sm py-xs text-sm"
                />
                <button onClick={handleVerify2FA} className="text-xs bg-primary text-on-primary px-sm py-xs rounded">Verify & Enable</button>
                {twoFaMsg && <span className="text-xs text-error">{twoFaMsg}</span>}
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-sm text-on-surface-variant">Not enabled</span>
                <button onClick={handleSetup2FA} className="text-xs bg-primary text-on-primary px-sm py-xs rounded">Set up 2FA</button>
              </div>
            )}
          </div>

          <form onSubmit={handlePasswordChange} className="flex flex-col gap-md flex-1">
            <h3 className="font-status text-status text-on-surface mb-xs">CHANGE PASSWORD</h3>
            {passwordMsg && (
              <div className={`px-sm py-xs rounded-md text-sm border ${passwordMsg.includes("success") ? "bg-success/10 text-success border-success/20" : "bg-error-container text-error border-error/20"}`}>
                {passwordMsg}
              </div>
            )}
            
            <div className="flex flex-col gap-xs">
              <label className="font-status text-status text-on-surface text-[10px]">CURRENT PASSWORD</label>
              <input 
                type="password" 
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-md py-sm text-on-surface placeholder-on-surface-variant focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary form-input"
                required 
              />
            </div>
            
            <div className="flex flex-col gap-xs">
              <label className="font-status text-status text-on-surface text-[10px]">NEW PASSWORD</label>
              <input 
                type="password" 
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-md py-sm text-on-surface placeholder-on-surface-variant focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary form-input"
                required 
                minLength={8}
              />
            </div>
            
            <div className="mt-auto pt-md">
              <button type="submit" className="bg-primary text-on-primary w-full py-sm rounded-lg font-button-label text-button-label transition-all hover:bg-inverse-surface">
                Update Password
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Active Sessions */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-lg shadow-sm">
        <h2 className="font-section-title text-section-title text-on-surface mb-md">Active Sessions</h2>
        <p className="text-sm text-on-surface-variant mb-lg">Manage and revoke your active sessions across different devices.</p>
        
        {sessions.length === 0 ? (
          <p className="text-sm text-on-surface-variant italic">No active sessions found.</p>
        ) : (
          <ul className="flex flex-col gap-sm border-t border-outline-variant pt-md">
            {sessions.map((s) => (
              <li key={s.id} className="border border-outline-variant bg-surface p-md rounded-lg flex justify-between items-center">
                <div className="flex items-center gap-md">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center border ${s.isCurrent ? "bg-success/10 border-success/30 text-success" : "bg-surface-container-high border-outline-variant text-on-surface-variant"}`}>
                    <span className="material-symbols-outlined">{s.isCurrent ? "devices" : "laptop_mac"}</span>
                  </div>
                  <div>
                    <p className="font-medium text-on-surface text-sm flex items-center gap-xs">
                      {s.userAgent || "Unknown Device"} 
                      {s.isCurrent && <span className="bg-success text-on-success text-[10px] px-2 py-0.5 rounded-full font-bold ml-1">THIS DEVICE</span>}
                    </p>
                    <p className="text-xs text-on-surface-variant font-technical-data mt-0.5">IP: {s.ipAddress || "Unknown"} • {s.isCurrent ? "Active now" : `Expires ${new Date(s.expiresAt).toLocaleDateString()}`}</p>
                  </div>
                </div>
                {!s.isCurrent && (
                  <button onClick={() => handleRevokeSession(s.id)} className="text-error border border-error/30 bg-error-container/30 px-3 py-1.5 rounded-md hover:bg-error-container transition-colors text-xs font-medium">
                    Revoke
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Danger Zone */}
      <div className="bg-error-container/50 border border-error/30 rounded-xl p-lg mt-md">
        <div className="flex items-start gap-md">
          <span className="material-symbols-outlined text-error text-[28px]">warning</span>
          <div>
            <h2 className="font-section-title text-section-title text-error mb-xs">Danger Zone</h2>
            <p className="text-sm text-on-error-container mb-md">Once you delete your account, there is no going back. All your data, settings, and sessions will be permanently destroyed. Please be certain.</p>
            <button onClick={handleDeleteAccount} className="bg-error text-on-error font-button-label text-button-label px-lg py-sm rounded-lg hover:bg-error/90 transition-colors shadow-sm">
              Delete Account
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
