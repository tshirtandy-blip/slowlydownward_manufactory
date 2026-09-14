import { prisma } from "@/lib/prisma";
import { createStaffUser, toggleUserActive } from "../actions";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-2xl mb-8">Staff &amp; access</h1>

      <table className="w-full text-sm mb-10 border hairline">
        <thead>
          <tr className="label-caps text-left border-b hairline">
            <th className="p-3">Name</th>
            <th className="p-3">Email</th>
            <th className="p-3">Role</th>
            <th className="p-3">Status</th>
            <th className="p-3"></th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} className="border-b hairline last:border-0">
              <td className="p-3">{user.name}</td>
              <td className="p-3">{user.email}</td>
              <td className="p-3">{user.role}</td>
              <td className="p-3">{user.active ? "Active" : "Disabled"}</td>
              <td className="p-3">
                <form action={toggleUserActive.bind(null, user.id, !user.active)}>
                  <button className="text-xs underline text-stone hover:text-ink">
                    {user.active ? "Disable" : "Enable"}
                  </button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="label-caps mb-4">Add staff account</h2>
      <form action={createStaffUser} className="space-y-4 max-w-sm">
        <input name="name" placeholder="Name" required className="border hairline bg-transparent px-3 py-2 text-sm w-full" />
        <input
          name="email"
          type="email"
          placeholder="Email"
          required
          className="border hairline bg-transparent px-3 py-2 text-sm w-full"
        />
        <input
          name="password"
          type="password"
          placeholder="Temporary password"
          required
          minLength={8}
          className="border hairline bg-transparent px-3 py-2 text-sm w-full"
        />
        <select name="role" required className="border hairline bg-transparent px-3 py-2 text-sm w-full">
          <option value="ADMIN">Admin — full access</option>
          <option value="SALES">Sales — orders &amp; reporting</option>
          <option value="STOCK">Stock — products &amp; editions</option>
          <option value="PACKER">Packer — packing queue only</option>
        </select>
        <button className="btn-primary">Create account</button>
      </form>
    </div>
  );
}
