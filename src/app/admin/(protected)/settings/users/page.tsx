import { prisma } from "@/lib/prisma";
import { createStaffUser, toggleUserActive } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-2xl mb-8">Staff &amp; access</h1>

      <Card className="mb-10 border-line shadow-none">
        <CardHeader>
          <CardTitle className="font-display text-lg font-normal">Staff</CardTitle>
          <CardDescription>Everyone with access to this admin panel.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.role}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{user.active ? "Active" : "Disabled"}</Badge>
                  </TableCell>
                  <TableCell>
                    <form action={toggleUserActive.bind(null, user.id, !user.active)}>
                      <Button variant="ghost" size="sm" type="submit">
                        {user.active ? "Disable" : "Enable"}
                      </Button>
                    </form>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="max-w-sm border-line shadow-none">
        <CardHeader>
          <CardTitle className="font-display text-lg font-normal">Add staff account</CardTitle>
          <CardDescription>They&apos;ll sign in with this email and temporary password.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createStaffUser} className="space-y-4">
            <Input name="name" placeholder="Name" required className="border-line" />
            <Input name="email" type="email" placeholder="Email" required className="border-line" />
            <Input name="password" type="password" placeholder="Temporary password" required minLength={8} className="border-line" />
            <select
              name="role"
              required
              className="flex h-10 w-full border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="ADMIN">Admin — full access</option>
              <option value="SALES">Sales — orders &amp; reporting</option>
              <option value="STOCK">Stock — products &amp; editions</option>
              <option value="PACKER">Packer — packing queue only</option>
            </select>
            <Button type="submit" className="w-full">
              Create account
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
