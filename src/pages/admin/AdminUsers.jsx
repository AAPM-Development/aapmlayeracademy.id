// @ts-nocheck
import React, { useEffect, useState } from "react";
import AapmIcon from "@/components/icons/AapmIcon";
import {
  Badge,
  Button,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Surface,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useToast,
} from "@/components/primitives";
import {
  useAdminUsers,
  useCreateAdminUser,
  useResetAdminUserPassword,
  useUpdateAdminUser,
} from "@/lib/useAdminData";
import { AdminError, AdminLoading, AdminPageFrame, AdminUnavailable } from "@/components/admin/AdminPage";
import { formatAdminDate } from "@/components/admin/adminUtils";

function UserDialog({ user, open, onOpenChange }) {
  const isNew = !user;
  const createUser = useCreateAdminUser();
  const updateUser = useUpdateAdminUser();
  const resetPassword = useResetAdminUserPassword();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("learner");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordConfirmationOpen, setPasswordConfirmationOpen] = useState(false);

  useEffect(() => {
    setName(user?.full_name || "");
    setEmail(user?.email || "");
    setRole(user?.role === "admin" ? "admin" : "learner");
    setPassword("");
    setNewPassword("");
  }, [user, open]);

  const save = async (event) => {
    event.preventDefault();
    try {
      if (isNew) {
        await createUser.mutateAsync({ fullName: name, email, password, role });
        toast({ title: "Akun dibuat", description: "Pengguna dapat login dengan password yang Anda tetapkan." });
      } else {
        await updateUser.mutateAsync({ userId: user.id, data: { fullName: name, role } });
        toast({ title: "Akun diperbarui", description: "Nama dan role pengguna telah disimpan." });
      }
      onOpenChange(false);
    } catch (saveError) {
      toast({ variant: "destructive", title: "Perubahan gagal", description: saveError.message });
    }
  };

  const changePassword = () => {
    if (newPassword) setPasswordConfirmationOpen(true);
  };

  const confirmChangePassword = async () => {
    setPasswordConfirmationOpen(false);
    if (!newPassword || !user) return;
    try {
      await resetPassword.mutateAsync({ userId: user.id, password: newPassword });
      setNewPassword("");
      toast({ title: "Password diperbarui", description: "Password lama tidak dapat digunakan lagi." });
    } catch (passwordError) {
      toast({ variant: "destructive", title: "Password belum diubah", description: passwordError.message });
    }
  };

  return <><Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="aapm-scroll-fade max-h-[min(90dvh,44rem)] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>{isNew ? "Buat akun" : "Kelola akun"}</DialogTitle><DialogDescription>{isNew ? "Buat akses learner atau admin dengan password awal yang Anda tetapkan." : "Email bersifat identitas akun dan tidak dapat diubah dari panel ini."}</DialogDescription></DialogHeader><form className="mt-2 space-y-4" onSubmit={save}><div className="space-y-2"><Label htmlFor="admin-user-name">Nama</Label><Input id="admin-user-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={160} required /></div><div className="space-y-2"><Label htmlFor="admin-user-email">Email</Label><Input id="admin-user-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} disabled={!isNew} required /></div><div className="space-y-2"><Label>Role</Label><Select value={role} onValueChange={setRole}><SelectTrigger className="h-11"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="learner">Learner</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent></Select></div>{isNew && <div className="space-y-2"><Label htmlFor="admin-user-password">Password awal</Label><Input id="admin-user-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} placeholder="Minimal 8 karakter, huruf dan angka" required /><p className="text-[11px] text-muted-foreground">Password tidak akan ditampilkan kembali setelah akun dibuat.</p></div>}<Button type="submit" className="w-full" disabled={createUser.isPending || updateUser.isPending}>{isNew ? (createUser.isPending ? "Membuat akun…" : "Buat akun") : (updateUser.isPending ? "Menyimpan…" : "Simpan perubahan")}</Button></form>{!isNew && <div className="mt-6 border-t border-border pt-5"><div className="text-sm font-semibold">Ganti password</div><p className="mt-1 text-xs leading-5 text-muted-foreground">Tindakan ini tidak mengirimkan password melalui email. Berikan password baru secara aman kepada pengguna.</p><div className="mt-3 flex gap-2"><Input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={8} placeholder="Password baru" /><Button type="button" variant="outline" onClick={changePassword} disabled={resetPassword.isPending || !newPassword}>{resetPassword.isPending ? "Mengubah…" : "Ganti"}</Button></div></div>}</DialogContent></Dialog><ConfirmDialog open={passwordConfirmationOpen} onOpenChange={setPasswordConfirmationOpen} title="Ganti password pengguna?" description={`Password untuk ${user?.full_name || user?.email || "akun ini"} akan diganti dan password lama tidak dapat digunakan lagi.`} confirmLabel="Ganti password" icon="solar:lock-keyhole-bold" onConfirm={confirmChangePassword} /></>;
}

export default function AdminUsers() {
  const [search, setSearch] = useState("");
  const [dialogUser, setDialogUser] = useState(undefined);
  const { data, isLoading, error, refetch } = useAdminUsers(search);
  const users = data?.users || [];

  return <AdminPageFrame title="User management" description="Kelola akses akun, role admin, dan password dari satu tempat." actions={<Button onClick={() => setDialogUser(null)}><AapmIcon name="add" className="h-4 w-4" /> Buat akun</Button>}>
    <div className="mb-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"><label className="flex h-11 items-center gap-2 rounded-xl border border-input bg-background px-3 focus-within:border-brand-orange/55 focus-within:ring-2 focus-within:ring-brand-orange/15"><AapmIcon name="search" className="h-4 w-4 text-muted-foreground" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama atau email pengguna" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" /></label><Surface variant="muted" className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground"><AapmIcon name="users" className="h-4 w-4 text-brand-green" />{users.length} akun tampil</Surface></div>
    {isLoading ? <AdminLoading label="Memuat akun pengguna…" /> : error ? <AdminError error={error} onRetry={refetch} /> : !users.length ? <AdminUnavailable title="Tidak ada akun ditemukan" description="Ubah kata kunci pencarian atau buat akun baru." /> : <Surface className="overflow-hidden p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead className="pl-5">Pengguna</TableHead><TableHead>Role</TableHead><TableHead>Progress</TableHead><TableHead>Aktivitas</TableHead><TableHead className="pr-5 text-right">Kelola</TableHead></TableRow></TableHeader><TableBody>{users.map((user) => <TableRow key={user.id}><TableCell className="min-w-[230px] pl-5"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-tint-green text-xs font-semibold text-brand-green">{(user.full_name || user.email).slice(0, 1).toUpperCase()}</span><span className="min-w-0"><span className="block truncate font-semibold">{user.full_name || user.email}</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">{user.email}</span></span></div></TableCell><TableCell><Badge variant="soft" className={user.role === "admin" ? "bg-tint-orange text-tint-orange-foreground" : "bg-tint-green text-tint-green-foreground"}>{user.role === "admin" ? "Admin" : "Learner"}</Badge></TableCell><TableCell className="min-w-[130px]"><div className="mb-1 flex justify-between gap-2 text-xs"><span>{user.completedModules} modul</span><span>{user.progressPercent}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-brand-green" style={{ width: `${user.progressPercent}%` }} /></div></TableCell><TableCell className="text-xs text-muted-foreground">{formatAdminDate(user.lastActivity || user.created_at)}</TableCell><TableCell className="pr-5 text-right"><Button size="sm" variant="outline" onClick={() => setDialogUser(user)}><AapmIcon name="edit" className="h-3.5 w-3.5" /> Kelola</Button></TableCell></TableRow>)}</TableBody></Table></div></Surface>}
    <UserDialog user={dialogUser || undefined} open={dialogUser !== undefined} onOpenChange={(open) => !open && setDialogUser(undefined)} />
  </AdminPageFrame>;
}
