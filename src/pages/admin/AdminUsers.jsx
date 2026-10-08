// @ts-nocheck
import React, { useEffect, useRef, useState } from "react";
import AapmIcon from "@/components/icons/AapmIcon";
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
  SearchInput,
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
  Surface,
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
  AdminLoading,
  AdminPageFrame,
  AdminUnavailable,
} from "@/components/admin/AdminPage";
import { formatAdminDate } from "@/components/admin/adminUtils";

const FORM_ID = "admin-user-form";

function initialOf(user) {
  return (user?.full_name || user?.email || "?").slice(0, 1).toUpperCase();
}

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

  useEffect(() => {
    setName(user?.full_name || "");
    setEmail(user?.email || "");
    setRole(user?.role === "admin" ? "admin" : "learner");
    setPassword("");
    setNewPassword("");
    setPasswordConfirmationOpen(false);
    setProgressConfirmationOpen(false);
  }, [user, open]);

  const isSaving = createUser.isPending || updateUser.isPending;

  const save = async (event) => {
    event.preventDefault();
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
        title: "Perubahan gagal",
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
              <div className="aapm-user-sheet__identity">
                <span className="aapm-initial-avatar" data-size="lg" aria-hidden="true">{initialOf(user)}</span>
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
                <div className="aapm-field">
                  <Label htmlFor="admin-user-role">Role</Label>
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger id="admin-user-role"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="learner">Learner</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="aapm-field-hint">Admin dapat mengelola kurikulum, pengguna, dan pengaturan APPI.</p>
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
                    <p className="aapm-accordion-note">Password baru tidak dikirim lewat email. Berikan secara aman kepada pengguna.</p>
                    <div className="aapm-inline-field">
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
                    <p className="aapm-accordion-note">{user.progressEntries || 0} entri tersimpan. Reset menghapus status modul, nilai kuis, praktik, dan waktu belajar.</p>
                    <p className="aapm-accordion-note">Sertifikat, data farm, dan percakapan tidak ikut dihapus.</p>
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
        description={`Seluruh progress belajar ${displayName} akan dihapus permanen: status modul, nilai kuis, praktik, dan waktu belajar. Sertifikat, data farm, dan percakapan tetap dipertahankan.`}
        confirmLabel="Reset progress"
        icon="solar:restart-bold"
        destructive
        onConfirm={confirmResetProgress}
      />
    </>
  );
}

export default function AdminUsers() {
  const [search, setSearch] = useState("");
  const [sheetUser, setSheetUser] = useState(undefined);
  const lastSheetUser = useRef(undefined);
  if (sheetUser !== undefined) lastSheetUser.current = sheetUser;
  const displayUser = sheetUser !== undefined ? sheetUser : lastSheetUser.current;
  const { data, isLoading, error, refetch } = useAdminUsers(search);
  const users = data?.users || [];

  return (
    <AdminPageFrame
      title="Pengguna & akses"
      description="Kelola akses akun, role, password, dan reset progress dari satu tempat."
      actions={
        <Button onClick={() => setSheetUser(null)}>
          <AapmIcon name="add" />
          Buat akun
        </Button>
      }
    >
      <div className="aapm-toolbar mb-5">
        <SearchInput
          className="w-full sm:max-w-sm"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Cari nama atau email pengguna"
          aria-label="Cari pengguna"
        />
        <span className="aapm-toolbar__spacer" />
        <Badge variant="soft">
          <AapmIcon name="users" />
          {users.length} akun tampil
        </Badge>
      </div>

      {isLoading ? (
        <AdminLoading label="Memuat akun pengguna…" />
      ) : error ? (
        <AdminError error={error} onRetry={refetch} />
      ) : !users.length ? (
        <AdminUnavailable
          title="Tidak ada akun ditemukan"
          description="Ubah kata kunci pencarian atau buat akun baru."
        />
      ) : (
        <Surface className="p-0">
          <DataTable
            caption="Daftar pengguna dan progres pembelajaran"
            responsive="stacked"
            rows={users}
            rowKey={(user) => String(user.id)}
            columns={[
              {
                key: "user",
                header: "Pengguna",
                required: true,
                overflow: "wrap",
                render: (user) => (
                  <div className="aapm-user-cell">
                    <span className="aapm-initial-avatar" aria-hidden="true">{initialOf(user)}</span>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{user.full_name || user.email}</span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">{user.email}</span>
                      <span className="mt-0.5 block text-[11px] text-muted-foreground">Aktif {formatAdminDate(user.lastActivity || user.created_at)}</span>
                    </span>
                  </div>
                ),
              },
              {
                key: "role",
                header: "Role",
                overflow: "nowrap",
                render: (user) => <Badge variant={user.role === "admin" ? "warning" : "success"}>{user.role === "admin" ? "Admin" : "Learner"}</Badge>,
              },
              {
                key: "progress",
                header: "Progress",
                overflow: "wrap",
                render: (user) => (
                  <div className="aapm-user-progress">
                    <div className="mb-1 flex justify-between gap-2 text-xs">
                      <span>{user.completedModules} modul</span>
                      <span className="tabular-nums">{user.progressPercent}%</span>
                    </div>
                    <Progress value={user.progressPercent} size="sm" aria-label={`Progress ${user.progressPercent}%`} />
                  </div>
                ),
              },
              {
                key: "actions",
                header: "Kelola",
                align: "right",
                required: true,
                overflow: "nowrap",
                render: (user) => (
                  <Button size="sm" variant="outline" onClick={() => setSheetUser(user)}>
                    <AapmIcon name="edit" />
                    Kelola
                  </Button>
                ),
              },
            ]}
          />
        </Surface>
      )}
      <UserSheet
        user={displayUser || undefined}
        open={sheetUser !== undefined}
        onOpenChange={(open) => !open && setSheetUser(undefined)}
      />
    </AdminPageFrame>
  );
}
