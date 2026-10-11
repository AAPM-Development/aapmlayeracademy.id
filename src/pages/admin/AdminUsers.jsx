// @ts-nocheck
import React, { useEffect, useRef, useState } from "react";
import AapmIcon from "@/components/icons/AapmIcon";
import { initialsOf } from "@/components/ProfileAvatar";
import { Bar, Ic } from "@/design-system/canvas";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Badge,
  Button,
  ConfirmDialog,
  DataTable,
  Field,
  FormGrid,
  FormSection,
  Input,
  Label,
  Progress,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  useToast,
} from "@/components/primitives";
import {
  useAdminUsers,
  useCreateAdminUser,
  useResetAdminUserPassword,
  useResetAdminUserProgress,
  useUpdateAdminUser,
} from "@/lib/useAdminData";
import {
  AdminError,
  AdminPageFrame,
} from "@/components/admin/AdminPage";
import { formatAdminDate } from "@/components/admin/adminUtils";
import { useAuth } from "@/lib/AuthContext";

const FORM_ID = "admin-user-form";

/* Kelola akun: identity first; security and progress reset are one step away. */
function UserSheet({ user, open, onOpenChange }) {
  const isNew = !user;
  const createUser = useCreateAdminUser();
  const updateUser = useUpdateAdminUser();
  const resetPassword = useResetAdminUserPassword();
  const resetProgress = useResetAdminUserProgress();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("learner");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordConfirmationOpen, setPasswordConfirmationOpen] = useState(false);
  const [progressConfirmationOpen, setProgressConfirmationOpen] = useState(false);
  const [roleConfirmationOpen, setRoleConfirmationOpen] = useState(false);

  useEffect(() => {
    setName(user?.full_name || "");
    setEmail(user?.email || "");
    setRole(user?.assignedRole || user?.role || "learner");
    setPassword("");
    setNewPassword("");
    setPasswordConfirmationOpen(false);
    setProgressConfirmationOpen(false);
    setRoleConfirmationOpen(false);
  }, [user, open]);

  const isSaving = createUser.isPending || updateUser.isPending;

  const save = async (event, confirmed = false) => {
    event?.preventDefault();
    const previousRole = user?.assignedRole || user?.role || "learner";
    if (!confirmed && role !== previousRole) {
      setRoleConfirmationOpen(true);
      return;
    }
    setRoleConfirmationOpen(false);
    try {
      if (isNew) {
        await createUser.mutateAsync({ fullName: name, email, password, role });
        toast({
          title: "Akun dibuat",
          description: "Pengguna dapat login dengan password yang Anda tetapkan.",
        });
      } else {
        await updateUser.mutateAsync({
          userId: user.id,
          data: { fullName: name, role },
        });
        toast({
          title: "Akun diperbarui",
          description: "Nama dan role pengguna telah disimpan.",
        });
      }
      onOpenChange(false);
    } catch (saveError) {
      toast({
        variant: "destructive",
        title: isNew ? "Akun belum dibuat" : "Perubahan belum disimpan",
        description: saveError.message,
      });
    }
  };

  const confirmChangePassword = async () => {
    setPasswordConfirmationOpen(false);
    if (!newPassword || !user) return;
    try {
      await resetPassword.mutateAsync({ userId: user.id, password: newPassword });
      setNewPassword("");
      toast({
        title: "Password diperbarui",
        description: "Password lama tidak dapat digunakan lagi.",
      });
    } catch (passwordError) {
      toast({
        variant: "destructive",
        title: "Password belum diubah",
        description: passwordError.message,
      });
    }
  };

  const confirmResetProgress = async () => {
    setProgressConfirmationOpen(false);
    if (!user) return;
    try {
      const result = await resetProgress.mutateAsync({ userId: user.id });
      const deletedEntries = result?.reset?.deletedEntries || 0;
      toast({
        title: "Progress direset",
        description: deletedEntries
          ? `${deletedEntries} entri progress dihapus. Sertifikat, data farm, dan percakapan tetap ada.`
          : "Belum ada entri progress. Data akun lain tetap ada.",
      });
      onOpenChange(false);
    } catch (progressError) {
      toast({
        variant: "destructive",
        title: "Progress belum direset",
        description: progressError.message,
      });
    }
  };

  const displayName = user?.full_name || user?.email || "akun ini";

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="aapm-form-sheet">
          <SheetHeader>
            {isNew ? (
              <>
                <SheetTitle>Buat akun</SheetTitle>
                <SheetDescription>Buat akses learner atau admin dengan password awal yang Anda tetapkan.</SheetDescription>
              </>
            ) : (
              <div className="row gap-3" style={{ minWidth: 0 }}>
                <span className="avatar avatar-lg" data-hue="green" aria-hidden="true">{initialsOf(user.full_name || user.email)}</span>
                <div className="min-w-0">
                  <SheetTitle className="truncate">{user.full_name || user.email}</SheetTitle>
                  <SheetDescription className="truncate">{user.email}</SheetDescription>
                </div>
              </div>
            )}
          </SheetHeader>

          <form id={FORM_ID} className="aapm-form-sheet__body" onSubmit={save}>
            <FormSection title="Identitas" description="Nama dan role menentukan apa yang dilihat pengguna di Academy.">
              <FormGrid columns={1}>
                <Field id="admin-user-name" label="Nama" required>
                  <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={160} required />
                </Field>
                <Field id="admin-user-email" label="Email" hint={isNew ? "Email menjadi identitas login." : "Email adalah identitas akun dan tidak dapat diubah."}>
                  <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} disabled={!isNew} required />
                </Field>
                <div className="field">
                  <Label htmlFor="admin-user-role">Peran</Label>
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger id="admin-user-role"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="learner">Peserta</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="hint">{role === "admin" ? "Admin mengelola materi dan operasional Academy. Pengelolaan akses akun hanya untuk Super Admin. Akses admin aktif setelah email terverifikasi." : "Learner belajar di Academy dan melihat progresnya sendiri."}</p>
                </div>
              </FormGrid>
            </FormSection>

            {isNew ? (
              <FormSection title="Password awal" description="Password tidak ditampilkan kembali setelah akun dibuat.">
                <Field id="admin-user-password" label="Password" required hint="Minimal 8 karakter, huruf dan angka.">
                  <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} autoComplete="new-password" required />
                </Field>
              </FormSection>
            ) : (
              <Accordion type="multiple" className="aapm-manage-accordion">
                <AccordionItem value="security">
                  <AccordionTrigger>
                    <span>Keamanan & password</span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <p className="t-support t-muted">Password baru tidak dikirim lewat email. Berikan secara aman kepada pengguna.</p>
                    <div className="row gap-2">
                      <Input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={8} placeholder="Password baru" aria-label="Password baru" autoComplete="new-password" />
                      <Button type="button" variant="outline" onClick={() => newPassword && setPasswordConfirmationOpen(true)} disabled={resetPassword.isPending || !newPassword}>
                        {resetPassword.isPending ? "Mengubah…" : "Ganti password"}
                      </Button>
                    </div>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="progress">
                  <AccordionTrigger>
                    <span>Progress belajar</span>
                    <Badge variant="soft">{user.completedModules || 0} modul · {user.progressPercent || 0}%</Badge>
                  </AccordionTrigger>
                  <AccordionContent>
                    <Progress value={user.progressPercent || 0} aria-label={`Progress ${user.progressPercent || 0}%`} />
                    <p className="t-support t-muted">{user.progressEntries || 0} entri tersimpan. Reset memulai periode belajar baru; riwayat nilai dan percobaan kuis tetap tersimpan.</p>
                    <p className="t-support t-muted">Sertifikat, data farm, dan percakapan tidak ikut dihapus.</p>
                    <Button type="button" variant="danger-soft" size="sm" onClick={() => setProgressConfirmationOpen(true)} disabled={resetProgress.isPending}>
                      <AapmIcon name="refresh" />
                      {resetProgress.isPending ? "Mereset…" : "Reset progress"}
                    </Button>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}
          </form>

          <SheetFooter className="aapm-form-sheet__footer">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Batal</Button>
            <Button type="submit" form={FORM_ID} loading={isSaving}>
              {isNew ? "Buat akun" : "Simpan perubahan"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={roleConfirmationOpen}
        onOpenChange={setRoleConfirmationOpen}
        title={role === "admin" ? "Berikan akses Admin?" : "Cabut akses Admin?"}
        description={role === "admin" ? `${displayName} dapat mengelola materi dan operasional Academy setelah email terverifikasi. Pengelolaan akses akun tetap untuk Super Admin.` : `${displayName} kembali menjadi Learner. Sesi lama akan dibatalkan; riwayat belajarnya tetap tersimpan.`}
        confirmLabel={role === "admin" ? "Berikan akses Admin" : "Jadikan Learner"}
        onConfirm={() => save(null, true)}
      />
      <ConfirmDialog
        open={passwordConfirmationOpen}
        onOpenChange={setPasswordConfirmationOpen}
        title="Ganti password pengguna?"
        description={`Password untuk ${displayName} akan diganti dan password lama tidak dapat digunakan lagi.`}
        confirmLabel="Ganti password"
        icon="solar:lock-keyhole-bold"
        onConfirm={confirmChangePassword}
      />
      <ConfirmDialog
        open={progressConfirmationOpen}
        onOpenChange={setProgressConfirmationOpen}
        title="Reset progress pengguna?"
        description={`Mulai periode belajar baru untuk ${displayName}? Progress aktif dimulai kembali. Riwayat kuis, sertifikat, data farm, dan percakapan tetap tersimpan.`}
        confirmLabel="Reset progress"
        icon="solar:restart-bold"
        destructive
        onConfirm={confirmResetProgress}
      />
    </>
  );
}

const PAGE_SIZE = 10;
const AVATAR_HUES = ["green", "blue", "violet", "teal", "amber", "rose"];
const ROLE_FILTERS = {
  all: () => true,
  learner: (user) => !["admin", "super_admin"].includes(user.assignedRole || user.role),
  admin: (user) => ["admin", "super_admin"].includes(user.assignedRole || user.role),
};

function RoleCell({ user }) {
  const role = user.assignedRole || user.role;
  if (role === "super_admin") {
    return (
      <span className="row gap-2">
        <span className="chip chip-hue" data-hue="violet"><Ic name="shield" />Super Admin</span>
        <span className="row gap-1 t-caption t-muted t-nowrap"><Ic name="lock" size="xs" />Dilindungi</span>
      </span>
    );
  }
  if (role === "admin") return <span className="chip chip-hue" data-hue="blue">Admin</span>;
  return <span className="chip">Peserta</span>;
}

function VerificationCell({ user }) {
  // Server-computed state. Admin access needs verified identity; legacy accounts keep learner access.
  if (user.emailVerificationStatus === "verified") return <span className="chip chip-success"><Ic name="check" />Terverifikasi</span>;
  if (user.emailVerificationStatus === "pending") return <span className="chip chip-warning"><Ic name="clock" />Menunggu verifikasi</span>;
  return <span className="chip chip-outline"><Ic name="history" />Verifikasi lama</span>;
}

export default function AdminUsers() {
  const { user: actor } = useAuth();
  const canManage = actor?.canManageUsers === true;
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [sheetUser, setSheetUser] = useState(undefined);
  const lastSheetUser = useRef(undefined);
  if (sheetUser !== undefined) lastSheetUser.current = sheetUser;
  const displayUser = sheetUser !== undefined ? sheetUser : lastSheetUser.current;
  const { data, isLoading, error, refetch } = useAdminUsers(search);
  const users = (data?.users || []).filter(ROLE_FILTERS[roleFilter]);
  const pages = Math.max(1, Math.ceil(users.length / PAGE_SIZE));
  useEffect(() => setPage(0), [search, roleFilter]);
  const current = Math.min(page, pages - 1);
  const visible = users.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);
  const isAdminRole = (user) => ["admin", "super_admin"].includes(user.assignedRole || user.role);

  return (
    <AdminPageFrame
      title="Pengguna"
      description={canManage ? "Kelola akun dan akses admin. Akun Super Admin dilindungi; admin baru perlu memverifikasi email." : "Lihat akun dan status verifikasi. Perubahan akses dikelola oleh Super Admin."}
      actions={canManage ? <button type="button" className="btn btn-primary" onClick={() => setSheetUser(null)}><Ic name="plus" />Buat akun</button> : null}
    >
      {error ? <AdminError error={error} onRetry={refetch} /> : (
        <section className="card" aria-labelledby="list-title">
          <h2 className="sr-only" id="list-title">Daftar pengguna</h2>
          <div className="toolbar" style={{ padding: "12px var(--card-pad)" }}>
            <label className="search" style={{ flex: "1 1 260px", maxWidth: 360 }}>
              <Ic name="search" size="sm" /><span className="sr-only">Cari pengguna</span>
              <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama atau email pengguna" />
            </label>
            <div className="seg" role="group" aria-label="Filter peran">
              {[["all", "Semua"], ["learner", "Peserta"], ["admin", "Admin"]].map(([value, label]) => (
                <button key={value} type="button" aria-pressed={roleFilter === value} onClick={() => setRoleFilter(value)}>{label}</button>
              ))}
            </div>
            {!isLoading ? <span className="t-support t-muted t-num ml-auto" aria-live="polite">{users.length} pengguna</span> : null}
          </div>
          <DataTable
            framed={false}
            className="card-sect"
            caption="Daftar pengguna dan progres pembelajaran"
            responsive="stacked"
            loading={isLoading}
            rows={visible}
            emptyMessage="Tidak ada akun ditemukan. Ubah kata kunci pencarian atau filter peran."
            selectedKey={sheetUser ? String(sheetUser.id) : undefined}
            rowKey={(user) => String(user.id)}
            columns={[
              {
                key: "user", header: "Pengguna", required: true,
                render: (user) => (
                  <span className="row gap-3">
                    <span className="avatar avatar-sm" data-hue={(user.assignedRole || user.role) === "super_admin" ? "neutral" : AVATAR_HUES[(Number(user.id) || 0) % AVATAR_HUES.length]}>{initialsOf(user.full_name || user.email)}</span>
                    <span className="stack" style={{ minWidth: 0 }}><span className="t-medium t-clamp-1">{user.full_name || user.email}</span><span className="t-caption t-muted t-clamp-1">{user.email}</span></span>
                  </span>
                ),
              },
              { key: "role", header: "Peran", render: (user) => <RoleCell user={user} /> },
              { key: "verification", header: "Verifikasi", render: (user) => <VerificationCell user={user} /> },
              {
                key: "progress", header: "Progres",
                render: (user) => (isAdminRole(user)
                  ? <span className="t-muted"><span aria-hidden="true">—</span><span className="sr-only">Tidak berlaku</span></span>
                  : <div className="row gap-3"><Bar value={user.progressPercent} size="sm" style={{ width: 72 }} /><span className={`t-support t-num${user.progressPercent ? "" : " t-muted"}`}>{user.progressPercent}%</span></div>),
              },
              { key: "lastActivity", header: "Aktif terakhir", render: (user) => <span className="t-muted t-nowrap">{user.lastActivity ? formatAdminDate(user.lastActivity) : "Belum pernah"}</span> },
              {
                key: "actions", header: <span className="sr-only">Tindakan</span>, align: "end", required: true,
                render: (user) => {
                  const protectedAccount = user.assignedRole === "super_admin";
                  return (
                    <div className="row gap-1 justify-end">
                      <button type="button" className="btn btn-secondary btn-sm" disabled={!canManage || protectedAccount} aria-expanded={sheetUser?.id === user.id || undefined} aria-label={protectedAccount ? `Kelola ${user.full_name || user.email} (dilindungi)` : undefined} onClick={() => setSheetUser(user)}>
                        {protectedAccount ? <Ic name="lock" /> : null}Kelola
                      </button>
                    </div>
                  );
                },
              },
            ]}
          />
          {!isLoading && users.length ? (
            <nav className="card-foot between" aria-label="Halaman daftar pengguna">
              <span className="t-support t-muted t-num">{current * PAGE_SIZE + 1}–{Math.min(users.length, (current + 1) * PAGE_SIZE)} dari {users.length}</span>
              <div className="row gap-3">
                <span className="t-support t-muted t-num hide-sm">Halaman {current + 1} dari {pages}</span>
                <div className="row gap-2">
                  <button type="button" className="btn btn-secondary btn-sm btn-icon" disabled={current === 0} aria-label="Halaman sebelumnya" onClick={() => setPage(current - 1)}><Ic name="chev-left" /></button>
                  <button type="button" className="btn btn-secondary btn-sm btn-icon" disabled={current >= pages - 1} aria-label="Halaman berikutnya" onClick={() => setPage(current + 1)}><Ic name="chev-right" /></button>
                </div>
              </div>
            </nav>
          ) : null}
        </section>
      )}
      <UserSheet
        user={displayUser || undefined}
        open={sheetUser !== undefined}
        onOpenChange={(open) => !open && setSheetUser(undefined)}
      />
    </AdminPageFrame>
  );
}
