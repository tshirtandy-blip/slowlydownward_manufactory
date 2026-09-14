"use client";

import { useState, useTransition } from "react";
import { COUNTRIES } from "@/lib/countries";
import { saveAddress, deleteAddress, setDefaultAddress, type AddressInput } from "./actions";

type AddressRow = AddressInput & { id: string };

const inputClass = "border hairline bg-transparent px-3 py-2 text-sm w-full";
const SORTED_COUNTRIES = [...COUNTRIES].sort((a, b) => a.name.localeCompare(b.name));
const EMPTY: AddressInput = {
  label: "",
  fullName: "",
  line1: "",
  line2: "",
  city: "",
  region: "",
  postalCode: "",
  countryCode: "GB",
  phone: "",
  isDefault: false,
};

function AddressFields({ value, onChange }: { value: AddressInput; onChange: (next: AddressInput) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2">
        <label className="label-caps block mb-2">Label (optional)</label>
        <input
          value={value.label ?? ""}
          onChange={(e) => onChange({ ...value, label: e.target.value })}
          placeholder="e.g. Home, Studio"
          className={inputClass}
        />
      </div>
      <div className="col-span-2">
        <label className="label-caps block mb-2">Full name</label>
        <input value={value.fullName} onChange={(e) => onChange({ ...value, fullName: e.target.value })} className={inputClass} />
      </div>
      <div className="col-span-2">
        <label className="label-caps block mb-2">Address line 1</label>
        <input value={value.line1} onChange={(e) => onChange({ ...value, line1: e.target.value })} className={inputClass} />
      </div>
      <div className="col-span-2">
        <label className="label-caps block mb-2">Address line 2 (optional)</label>
        <input value={value.line2 ?? ""} onChange={(e) => onChange({ ...value, line2: e.target.value })} className={inputClass} />
      </div>
      <div>
        <label className="label-caps block mb-2">City</label>
        <input value={value.city} onChange={(e) => onChange({ ...value, city: e.target.value })} className={inputClass} />
      </div>
      <div>
        <label className="label-caps block mb-2">County / state (optional)</label>
        <input value={value.region ?? ""} onChange={(e) => onChange({ ...value, region: e.target.value })} className={inputClass} />
      </div>
      <div>
        <label className="label-caps block mb-2">Postcode</label>
        <input value={value.postalCode} onChange={(e) => onChange({ ...value, postalCode: e.target.value })} className={inputClass} />
      </div>
      <div>
        <label className="label-caps block mb-2">Country</label>
        <select
          value={value.countryCode}
          onChange={(e) => onChange({ ...value, countryCode: e.target.value })}
          className={inputClass}
        >
          {SORTED_COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="col-span-2">
        <label className="label-caps block mb-2">Phone (optional)</label>
        <input value={value.phone ?? ""} onChange={(e) => onChange({ ...value, phone: e.target.value })} className={inputClass} />
      </div>
      <label className="col-span-2 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={!!value.isDefault} onChange={(e) => onChange({ ...value, isDefault: e.target.checked })} />
        Use as my default address
      </label>
    </div>
  );
}

export function AddressBook({ initialAddresses }: { initialAddresses: AddressRow[] }) {
  const [addresses, setAddresses] = useState(initialAddresses);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<AddressInput>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function startEdit(row: AddressRow) {
    setEditingId(row.id);
    setAdding(false);
    setDraft(row);
    setError(null);
  }

  function startAdd() {
    setAdding(true);
    setEditingId(null);
    setDraft(EMPTY);
    setError(null);
  }

  function cancel() {
    setAdding(false);
    setEditingId(null);
    setError(null);
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await saveAddress(editingId, draft);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // Simplest correct way to reflect a create/edit/default-swap without
      // hand-rolling that reconciliation logic client-side too.
      window.location.reload();
    });
  }

  function remove(id: string) {
    if (!confirm("Remove this address?")) return;
    startTransition(async () => {
      const result = await deleteAddress(id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setAddresses((prev) => prev.filter((a) => a.id !== id));
    });
  }

  function makeDefault(id: string) {
    startTransition(async () => {
      const result = await setDefaultAddress(id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      window.location.reload();
    });
  }

  return (
    <div className="space-y-6">
      <p className="text-stone text-sm">
        Saved here for your own reference — checkout still collects your shipping address directly through Stripe.
      </p>

      {error && <p className="text-sm text-accent">{error}</p>}

      {addresses.length === 0 && !adding && <p className="text-stone text-sm">No saved addresses yet.</p>}

      {addresses.map((row) =>
        editingId === row.id ? (
          <div key={row.id} className="border hairline p-5">
            <AddressFields value={draft} onChange={setDraft} />
            <div className="flex gap-3 mt-4">
              <button type="button" onClick={submit} disabled={pending} className="btn-primary disabled:opacity-50">
                {pending ? "Saving…" : "Save"}
              </button>
              <button type="button" onClick={cancel} className="btn-secondary">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div key={row.id} className="border hairline p-5 flex justify-between items-start gap-4">
            <div className="text-sm">
              {row.label ? (
                <p className="label-caps mb-1">
                  {row.label}
                  {row.isDefault ? " — Default" : ""}
                </p>
              ) : (
                row.isDefault && <p className="label-caps mb-1">Default</p>
              )}
              <p>{row.fullName}</p>
              <p className="text-stone">
                {[row.line1, row.line2, row.city, row.region, row.postalCode, COUNTRIES.find((c) => c.code === row.countryCode)?.name]
                  .filter(Boolean)
                  .join(", ")}
              </p>
              {row.phone && <p className="text-stone">{row.phone}</p>}
            </div>
            <div className="flex flex-col gap-2 text-xs shrink-0">
              <button type="button" onClick={() => startEdit(row)} className="underline hover:text-ink text-stone">
                Edit
              </button>
              {!row.isDefault && (
                <button type="button" onClick={() => makeDefault(row.id)} className="underline hover:text-ink text-stone">
                  Make default
                </button>
              )}
              <button type="button" onClick={() => remove(row.id)} className="underline hover:text-accent text-stone">
                Remove
              </button>
            </div>
          </div>
        )
      )}

      {adding ? (
        <div className="border hairline p-5">
          <AddressFields value={draft} onChange={setDraft} />
          <div className="flex gap-3 mt-4">
            <button type="button" onClick={submit} disabled={pending} className="btn-primary disabled:opacity-50">
              {pending ? "Saving…" : "Save address"}
            </button>
            <button type="button" onClick={cancel} className="btn-secondary">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={startAdd} className="btn-secondary">
          + Add address
        </button>
      )}
    </div>
  );
}
