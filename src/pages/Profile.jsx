import React, { useEffect, useRef, useState } from "react";
import AapmIcon from "@/components/icons/AapmIcon";
import ProfileAvatar from "@/components/ProfileAvatar";
import {
  Badge,
  Button,
  Input,
  Label,
  Surface,
  Switch,
  Textarea,
  useToast,
} from "@/components/primitives";
import { useAuth } from "@/lib/AuthContext";
import {
  useHallOfFame,
  useLearningProfile,
  useSaveLearningProfile,
} from "@/lib/useProfileData";

function Metric({ icon, label, value, detail, tone = "green" }) {
  const tones = {
    green: "border-tint-green-border bg-tint-green text-brand-green",
    orange: "border-tint-orange-border bg-tint-orange text-brand-orange",
    violet: "border-tint-violet-border bg-tint-violet text-tint-violet-foreground",
  };
  return (
    <Surface className="relative overflow-hidden p-4">
      <div className="flex items-start justify-between gap-3">
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl border ${tones[tone]}`}>
          <AapmIcon name={icon} className="h-4.5 w-4.5" />
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="mt-5 text-2xl font-semibold tracking-[-0.04em]">{value}</div>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </Surface>
  );
}

function resizeProfileImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Foto tidak dapat dibaca."));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("Format foto tidak didukung."));
      image.onload = () => {
        const side = Math.min(image.naturalWidth, image.naturalHeight);
        const sourceX = (image.naturalWidth - side) / 2;
        const sourceY = (image.naturalHeight - side) / 2;
        const canvas = document.createElement("canvas");
        canvas.width = 320;
        canvas.height = 320;
        const context = canvas.getContext("2d");
        context.drawImage(image, sourceX, sourceY, side, side, 0, 0, 320, 320);

        const candidates = [
          canvas.toDataURL("image/webp", 0.82),
          canvas.toDataURL("image/jpeg", 0.78),
        ];
        const result = candidates.find((value) => value.length <= 180000);
        if (!result) {
          reject(new Error("Foto terlalu besar setelah diproses. Pilih foto lain."));
          return;
        }
        resolve(result);
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export default function Profile() {
  const { data, isLoading, error, refetch } = useLearningProfile();
  const { data: hall } = useHallOfFame();
  const saveProfile = useSaveLearningProfile();
  const { checkUserAuth } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [optIn, setOptIn] = useState(false);
  const [avatarData, setAvatarData] = useState("");
  const [avatarError, setAvatarError] = useState("");
  const avatarInputRef = useRef(null);

  useEffect(() => {
    if (!data) return;
    setName(data.user?.full_name || "");
    setBio(data.profile?.bio || "");
    setOptIn(Boolean(data.profile?.hallOfFameOptIn));
    setAvatarData(data.profile?.avatar || data.user?.avatar || "");
  }, [data]);

  const handleAvatarSelection = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 8 * 1024 * 1024) {
      setAvatarError("Pilih foto JPG, PNG, atau WebP maksimal 8 MB.");
      return;
    }
    try {
      setAvatarError("");
      setAvatarData(await resizeProfileImage(file));
    } catch (error) {
      setAvatarError(error.message || "Foto belum dapat dipakai.");
    }
  };

  const save = async () => {
    try {
      await saveProfile.mutateAsync({ fullName: name, bio, hallOfFameOptIn: optIn, avatarData });
      await checkUserAuth();
      toast({ title: "Profil disimpan", description: "Pengaturan profil dan privasi Anda telah diperbarui." });
    } catch (saveError) {
      toast({ variant: "destructive", title: "Profil belum tersimpan", description: saveError.message });
    }
  };

  if (isLoading) {
    return <div className="mx-auto w-full max-w-[1360px] p-4 sm:p-6 lg:p-8"><Surface variant="muted" className="min-h-64 animate-pulse" /></div>;
  }
  if (error) {
    return <div className="mx-auto w-full max-w-[1360px] p-4 sm:p-6 lg:p-8"><Surface tone="orange" className="p-6"><h1 className="text-lg font-semibold">Profil belum dapat dimuat</h1><p className="mt-2 text-sm text-muted-foreground">{error.message}</p><Button className="mt-4" variant="outline" onClick={refetch}>Coba lagi</Button></Surface></div>;
  }

  const learning = data?.learning || {};
  const profileName = data?.user?.full_name || data?.user?.email || "Learner";
  const profileUser = { ...(data?.user || {}), avatar: avatarData };
  const nextLevelProgress = learning.nextLevelAt
    ? Math.min(100, Math.round((learning.points / learning.nextLevelAt) * 100))
    : 100;

  return (
    <div className="mx-auto w-full max-w-[1360px] space-y-6 p-4 sm:p-6 lg:p-8">
      <section className="overflow-hidden rounded-[calc(var(--card-radius)_+_0.25rem)] border border-border bg-surface-default shadow-[var(--surface-shadow)]">
        <div className="relative border-b border-border bg-surface-subtle px-5 py-7 sm:px-7 sm:py-9">
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <ProfileAvatar user={profileUser} name={profileName} className="h-16 w-16 rounded-2xl border border-brand-green/20 shadow-sm" fallbackClassName="rounded-2xl bg-tint-green text-xl text-brand-green" />
              <div className="min-w-0"><div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-orange">Profil belajar</div><h1 className="mt-1 truncate text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">{profileName}</h1><p className="mt-1 text-sm text-muted-foreground">{data?.user?.email}</p></div>
            </div>
            <div className="rounded-xl border border-border bg-background px-4 py-3"><div className="text-[10px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">Level saat ini</div><div className="mt-1 flex items-center gap-2 text-sm font-semibold"><AapmIcon name="award" className="h-4 w-4 text-brand-orange" />{learning.level}</div></div>
          </div>
        </div>
        <div className="grid gap-px bg-border sm:grid-cols-3"><div className="bg-background px-5 py-4"><div className="text-xs text-muted-foreground">Poin pembelajaran</div><div className="mt-1 text-xl font-semibold">{learning.points || 0}</div></div><div className="bg-background px-5 py-4"><div className="text-xs text-muted-foreground">Progress kurikulum</div><div className="mt-1 text-xl font-semibold">{learning.completedModules || 0}<span className="text-sm text-muted-foreground">/{learning.moduleTotal || 0} modul</span></div></div><div className="bg-background px-5 py-4"><div className="text-xs text-muted-foreground">Ke level berikutnya</div><div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-brand-orange transition-[width]" style={{ width: `${nextLevelProgress}%` }} /></div></div></div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon="course" label="Modul selesai" value={learning.completedModules || 0} detail={`${learning.progressPercent || 0}% dari kurikulum`} />
        <Metric icon="target" label="Rata-rata kuis" value={learning.quizAverage === null || learning.quizAverage === undefined ? "—" : `${learning.quizAverage}%`} detail="Dihitung dari nilai tersimpan" tone="orange" />
        <Metric icon="clock" label="Waktu belajar" value={`${Math.floor((learning.timeSpentMinutes || 0) / 60)}j`} detail={`${(learning.timeSpentMinutes || 0) % 60} menit tercatat`} tone="violet" />
        <Metric icon="certificate" label="Sertifikat" value={learning.certificateCount || 0} detail="Diterbitkan oleh Academy" />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(19rem,0.65fr)]">
        <Surface className="p-5 sm:p-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-brand-orange">Apresiasi berbasis aktivitas</div><h2 className="mt-1 text-lg font-semibold">Pencapaian Anda</h2><p className="mt-1 text-sm text-muted-foreground">{data?.achievementNote}</p></div><Badge variant="soft" className="bg-tint-green text-tint-green-foreground">{(learning.achievements || []).filter((item) => item.unlocked).length}/{(learning.achievements || []).length} terbuka</Badge></div><div className="mt-5 grid gap-3 sm:grid-cols-2">{(learning.achievements || []).map((achievement) => <div key={achievement.id} className={`rounded-xl border p-4 ${achievement.unlocked ? "border-tint-green-border bg-tint-green" : "border-border bg-surface-subtle"}`}><div className="flex items-start gap-3"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${achievement.unlocked ? "bg-background text-brand-green" : "bg-muted text-muted-foreground"}`}><AapmIcon name={achievement.icon} className="h-4 w-4" /></span><div className="min-w-0"><div className="flex items-center gap-2"><h3 className="text-sm font-semibold">{achievement.title}</h3>{achievement.unlocked && <AapmIcon name="check" className="h-4 w-4 text-brand-green" />}</div><p className="mt-1 text-xs leading-5 text-muted-foreground">{achievement.description}</p><p className="mt-2 text-[11px] font-medium text-muted-foreground">{Math.min(achievement.current, achievement.target)}/{achievement.target}</p></div></div></div>)}</div></Surface>
        <div className="space-y-5"><Surface className="p-5"><div className="flex items-center gap-2"><AapmIcon name="award" className="h-5 w-5 text-brand-orange" /><h2 className="text-base font-semibold">Hall of Fame</h2></div><p className="mt-2 text-xs leading-5 text-muted-foreground">{hall?.criteria}</p><div className="mt-4 space-y-2">{hall?.entries?.length ? hall.entries.slice(0, 5).map((entry) => <div key={entry.userId} className="flex items-center gap-3 rounded-xl border border-border bg-surface-subtle px-3 py-2.5"><span className="w-5 text-center text-xs font-semibold text-brand-orange">{entry.rank}</span><span className="flex h-8 w-8 items-center justify-center rounded-full bg-tint-green text-xs font-semibold text-brand-green">{entry.name.slice(0, 1).toUpperCase()}</span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{entry.name}</span><span className="block text-[10px] text-muted-foreground">{entry.level}</span></span><span className="text-xs font-semibold tabular-nums">{entry.points}</span></div>) : <p className="rounded-xl border border-dashed border-border p-3 text-xs leading-5 text-muted-foreground">Belum ada peserta yang memilih tampil di Hall of Fame.</p>}</div></Surface>
          <Surface className="p-5"><div className="flex items-center justify-between gap-3"><div><h2 className="text-base font-semibold">Pengaturan profil</h2><p className="mt-1 text-xs text-muted-foreground">Atur identitas yang tampil di ruang belajar.</p></div><AapmIcon name="settings" className="h-5 w-5 text-brand-orange" /></div><div className="mt-4 space-y-4"><div className="rounded-xl border border-border bg-surface-subtle p-3"><input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarSelection} className="sr-only" /><div className="flex items-center gap-3"><ProfileAvatar user={profileUser} name={profileName} className="h-14 w-14" fallbackClassName="bg-tint-green text-lg text-brand-green" /><div className="min-w-0 flex-1"><div className="text-xs font-semibold">Foto profil</div><p className="mt-1 text-[11px] leading-4 text-muted-foreground">Foto dipotong persegi dan disimpan aman di akun Anda.</p><div className="mt-2 flex flex-wrap gap-2"><Button type="button" variant="outline" size="sm" onClick={() => avatarInputRef.current?.click()}><AapmIcon name="solar:camera-bold-duotone" />{avatarData ? "Ganti foto" : "Tambah foto"}</Button>{avatarData && <Button type="button" variant="ghost" size="sm" onClick={() => { setAvatarData(""); setAvatarError(""); }}>Hapus</Button>}</div></div></div>{avatarError && <p className="mt-2 text-[11px] font-medium text-danger">{avatarError}</p>}</div><div className="space-y-2"><Label htmlFor="profile-name">Nama tampil</Label><Input id="profile-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={160} /></div><div className="space-y-2"><Label htmlFor="profile-bio">Tentang saya <span className="font-normal text-muted-foreground">(opsional)</span></Label><Textarea id="profile-bio" value={bio} onChange={(event) => setBio(event.target.value)} maxLength={600} rows={3} placeholder="Fokus belajar atau konteks farm yang ingin Anda bagikan." /></div><div className="flex items-start gap-3 rounded-xl border border-border bg-surface-subtle p-3"><Switch checked={optIn} onCheckedChange={setOptIn} aria-label="Tampilkan profil di Hall of Fame" /><div><div className="text-xs font-semibold">Tampilkan di Hall of Fame</div><p className="mt-1 text-[11px] leading-5 text-muted-foreground">Hanya nama, level, dan poin pembelajaran yang ditampilkan. Email tidak pernah ditampilkan.</p></div></div><Button className="w-full" onClick={save} disabled={saveProfile.isPending}>{saveProfile.isPending ? "Menyimpan…" : "Simpan profil"}</Button></div></Surface></div>
      </section>
    </div>
  );
}
