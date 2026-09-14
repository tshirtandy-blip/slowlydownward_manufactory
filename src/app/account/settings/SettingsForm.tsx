"use client";

import { useState, useTransition } from "react";
import { updateProfile, changePassword } from "./actions";

const inputClass = "border hairline bg-transparent px-3 py-2 text-sm w-full";

export function SettingsForm({
  email,
  initialFirstName,
  initialLastName,
  initialPhone,
  initialMarketingOptIn,
}: {
  email: string;
  initialFirstName: string;
  initialLastName: string;
  initialPhone: string;
  initialMarketingOptIn: boolean;
}) {
  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [phone, setPhone] = useState(initialPhone);
  const [marketingOptIn, setMarketingOptIn] = useState(initialMarketingOptIn);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profilePending, startProfileTransition] = useTransition();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordPending, startPasswordTransition] = useTransition();

  function submitProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileError(null);
    setProfileSaved(false);
    startProfileTransition(async () => {
      const result = await updateProfile({ firstName, lastName, phone, marketingOptIn });
      if (!result.ok) {
        setProfileError(result.error);
        return;
      }
      setProfileSaved(true);
    });
  }

  function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSaved(false);
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords don't match.");
      return;
    }
    startPasswordTransition(async () => {
      const result = await changePassword({ currentPassword, newPassword });
      if (!result.ok) {
        setPasswordError(result.error);
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSaved(true);
    });
  }

  return (
    <div className="space-y-12 max-w-md">
      <form onSubmit={submitProfile}>
        <h2 className="label-caps mb-4">Your details</h2>
        <div className="mb-4">
          <label className="label-caps block mb-2">Email</label>
          <input value={email} disabled className={inputClass + " opacity-60"} />
          <p className="text-xs text-stone mt-1">Contact us directly if you need to change the email on your account.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="label-caps block mb-2">First name</label>
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="label-caps block mb-2">Last name</label>
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} />
          </div>
        </div>
        <div className="mb-4">
          <label className="label-caps block mb-2">Phone (optional)</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
        </div>
        <label className="flex items-center gap-2 text-sm mb-6">
          <input type="checkbox" checked={marketingOptIn} onChange={(e) => setMarketingOptIn(e.target.checked)} />
          Email me about new releases
        </label>
        {profileError && <p className="text-sm text-accent mb-4">{profileError}</p>}
        {profileSaved && !profileError && <p className="text-sm text-stone mb-4">Saved.</p>}
        <button type="submit" disabled={profilePending} className="btn-primary disabled:opacity-50">
          {profilePending ? "Saving…" : "Save details"}
        </button>
      </form>

      <form onSubmit={submitPassword}>
        <h2 className="label-caps mb-4">Change password</h2>
        <div className="mb-4">
          <label className="label-caps block mb-2">Current password</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            className={inputClass}
          />
        </div>
        <div className="mb-4">
          <label className="label-caps block mb-2">New password</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
            className={inputClass}
          />
        </div>
        <div className="mb-6">
          <label className="label-caps block mb-2">Confirm new password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            className={inputClass}
          />
        </div>
        {passwordError && <p className="text-sm text-accent mb-4">{passwordError}</p>}
        {passwordSaved && !passwordError && <p className="text-sm text-stone mb-4">Password updated.</p>}
        <button type="submit" disabled={passwordPending} className="btn-primary disabled:opacity-50">
          {passwordPending ? "Updating…" : "Update password"}
        </button>
      </form>
    </div>
  );
}
