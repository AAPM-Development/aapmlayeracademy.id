import React, { useEffect, useRef, useState } from "react";
import ContentContainer from "@/components/layout/ContentContainer";
import PageHeader from "@/components/layout/PageHeader";
import AapmIcon from "@/components/icons/AapmIcon";
import ProfileAvatar from "@/components/ProfileAvatar";
import {
  Badge,
  Button,
  Field,
  FormActions,
  FormGrid,
  FormSection,
  IconTile,
  Input,
  KPICluster,
  Label,
  Progress,
  ProgressRing,
  SectionHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StateView,
  Surface,
  SwitchField,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  useToast,
} from "@/components/primitives";
import { useAuth } from "@/lib/AuthContext";
import {
  useHallOfFame,
  useLearningProfile,
  useSaveLearningProfile,
} from "@/lib/useProfileData";
import {
  useAiAccountSettings,
  useSaveAiAccountSettings,
} from "@/lib/useAiSettings";
import { usePwaInstall } from "@/lib/usePwaInstall";

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

/* Label + control for controls that cannot take Field's id cloning (Radix Select roots). */
function ControlField({ id, label, hint, children }) {
  return (
    <div className="aapm-field">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? <p className="aapm-field-hint">{hint}</p> : null}
    </div>
  );
}

function AiAccountPreferences() {
  const { data, isLoading, error, refetch } = useAiAccountSettings();
  const save = useSaveAiAccountSettings();
  const { toast } = useToast();
  const [mode, setMode] = useState("global");
  const [providerId, setProviderId] = useState("");
  const [model, setModel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [authMode, setAuthMode] = useState("bearer");
  const [apiKey, setApiKey] = useState("");
  const [allowLocal, setAllowLocal] = useState(false);
  const [supportsVision, setSupportsVision] = useState(false);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (!data) return;
    setMode(data.mode || "global");
    setProviderId(data.providerId || data.globalProviderId || "");
    setModel(data.model || "");
    setBaseUrl(data.customBaseUrl || "");
    setAuthMode(data.customAuthMode || "bearer");
    setAllowLocal(Boolean(data.customAllowLocal));
    setSupportsVision(Boolean(data.customSupportsVision));
    setEnabled(data.enabled !== false);
  }, [data]);

  const selectedProvider = data?.globalProviders?.find((item) => item.id === providerId);
  const savePreferences = async () => {
    try {
      await save.mutateAsync({
        mode,
        providerId: mode === "provider" ? providerId : "",
        model: model.trim(),
        baseUrl: baseUrl.trim(),
        authMode,
        allowLocal,
        supportsVision,
        enabled,
        ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
      });
      setApiKey("");
      toast({ title: "Preferensi APPI tersimpan", description: mode === "global" ? "Akun ini memakai Global AAPM Provider." : "Override APPI hanya berlaku untuk akun ini." });
    } catch (saveError) {
      toast({ variant: "destructive", title: "Preferensi APPI belum tersimpan", description: saveError.message });
    }
  };

  if (isLoading) return <Surface variant="muted" className="min-h-40 animate-pulse" aria-busy="true" />;
  if (error) {
    return (
      <StateView
        kind="error"
        title="Preferensi APPI belum tersedia"
        description={error.message}
        action={<Button variant="secondary" leadingIcon="refresh" onClick={refetch}>Coba lagi</Button>}
      />
    );
  }

  return (
    <Surface className="aapm-profile-panel p-5 sm:p-6">
      <SectionHeader
        title="Preferensi APPI"
        description="Pilih provider global Academy atau gunakan koneksi AI milik Anda sendiri."
        actions={<Badge variant="soft" hue="green">Per akun</Badge>}
      />
      <div className="aapm-profile-panel__body">
        <ControlField id="account-ai-mode" label="Sumber provider" hint={data?.note}>
          <Select value={mode} onValueChange={(value) => { setMode(value); if (value === "global") { setProviderId(data?.globalProviderId || ""); setModel(""); } }}>
            <SelectTrigger id="account-ai-mode"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="global">Global AAPM Provider · default</SelectItem>
              <SelectItem value="provider">Pilih provider global lain</SelectItem>
              <SelectItem value="custom">Provider saya sendiri · BYOK</SelectItem>
            </SelectContent>
          </Select>
        </ControlField>

        {mode === "provider" ? (
          <ControlField id="account-ai-provider" label="Provider global">
            <Select value={providerId} onValueChange={setProviderId}>
              <SelectTrigger id="account-ai-provider"><SelectValue placeholder="Pilih provider" /></SelectTrigger>
              <SelectContent>
                {(data?.globalProviders || []).map((provider) => <SelectItem key={provider.id} value={provider.id}>{provider.label} · {provider.model}</SelectItem>)}
              </SelectContent>
            </Select>
          </ControlField>
        ) : null}

        {mode === "global" || mode === "provider" ? (
          <Field id="account-ai-model" label="Model override" hint="Kosongkan agar mengikuti model yang dipilih admin. Isi ID model hanya jika provider mendukungnya.">
            <Input value={model} onChange={(event) => setModel(event.target.value)} placeholder={selectedProvider?.model || data?.globalModel || "Biarkan memakai model global"} />
          </Field>
        ) : null}

        {mode === "custom" ? (
          <FormSection title="Koneksi BYOK" description="Endpoint dan key disimpan hanya untuk akun ini.">
            <FormGrid columns={2}>
              <Field id="account-ai-base-url" label="Base URL provider Anda" className="sm:col-span-2">
                <Input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://gateway.example.com/v1" />
              </Field>
              <Field id="account-ai-custom-model" label="Model ID">
                <Input value={model} onChange={(event) => setModel(event.target.value)} placeholder="llama3.2 atau model provider" />
              </Field>
              <ControlField id="account-ai-auth" label="Autentikasi">
                <Select value={authMode} onValueChange={setAuthMode}>
                  <SelectTrigger id="account-ai-auth"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bearer">Bearer</SelectItem>
                    <SelectItem value="x-api-key">X-API-Key</SelectItem>
                    <SelectItem value="none">Tanpa key / local</SelectItem>
                  </SelectContent>
                </Select>
              </ControlField>
              <Field id="account-ai-key" label="API key Anda" hint={data?.apiKeyConfigured ? "Kosongkan untuk mempertahankan key yang tersimpan." : "Opsional untuk endpoint lokal. Key hanya tersimpan di akun Anda."} className="sm:col-span-2">
                <Input type="password" autoComplete="new-password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={data?.apiKeyConfigured ? "Tersimpan · isi untuk mengganti" : "Tempel API key"} />
              </Field>
            </FormGrid>
            <FormGrid columns={2}>
              <SwitchField id="account-ai-local" label="Endpoint privat / local" description="Izinkan HTTP loopback atau LAN privat." checked={allowLocal} onCheckedChange={setAllowLocal} />
              <SwitchField id="account-ai-vision" label="Input gambar" description="Aktifkan jika model Anda mendukung vision." checked={supportsVision} onCheckedChange={setSupportsVision} />
            </FormGrid>
          </FormSection>
        ) : null}

        <SwitchField id="account-ai-enabled" label="Izinkan APPI pada akun ini" description="Jika dimatikan, APPI memakai fallback lokal saat dipanggil." checked={enabled} onCheckedChange={setEnabled} />
      </div>
      <FormActions className="aapm-profile-panel__actions">
        <Button type="button" variant="ai" onClick={savePreferences} loading={save.isPending}>Simpan preferensi APPI</Button>
      </FormActions>
    </Surface>
  );
}

function PwaInstallShortcut() {
  const { canInstall, isInstalled, install } = usePwaInstall();
  const { toast } = useToast();

  const handleInstall = async () => {
    const result = await install();
    if (result?.outcome === "accepted") {
      toast({ title: "AAPM Academy dipasang", description: "Buka kembali dari layar utama untuk pengalaman PWA yang lebih ringkas." });
    }
  };

  return (
    <Surface className="aapm-pwa-install-card p-5 sm:p-6">
      <div className="aapm-profile-device">
        <IconTile icon="download" hue="green" size="lg" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold">Pasang AAPM di perangkat</h2>
            {isInstalled ? <Badge variant="soft" hue="green">Sudah terpasang</Badge> : null}
          </div>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {isInstalled
              ? "AAPM Academy sudah tersedia sebagai aplikasi mandiri di perangkat ini."
              : canInstall
                ? "Tambahkan shortcut ke layar utama agar belajar dan membuka APPI lebih cepat."
                : "Buka menu browser lalu pilih Install app / Tambahkan ke layar utama jika tombol belum tersedia."}
          </p>
          {!isInstalled ? (
            <Button type="button" className="mt-4" leadingIcon="download" onClick={handleInstall} disabled={!canInstall}>
              {canInstall ? "Install sekarang" : "Menunggu dukungan browser"}
            </Button>
          ) : null}
        </div>
      </div>
    </Surface>
  );
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
    return (
      <ContentContainer>
        <PageHeader eyebrow="Prestasi" title="Profil & prestasi" />
        <StateView kind="loading" title="Memuat profil…" framed={false} />
      </ContentContainer>
    );
  }
  if (error) {
    return (
      <ContentContainer>
        <PageHeader eyebrow="Prestasi" title="Profil & prestasi" />
        <StateView kind="error" title="Profil belum dapat dimuat" description={error.message} action={<Button variant="secondary" leadingIcon="refresh" onClick={refetch}>Coba lagi</Button>} />
      </ContentContainer>
    );
  }

  const learning = data?.learning || {};
  const profileName = data?.user?.full_name || data?.user?.email || "Learner";
  const profileUser = { ...(data?.user || {}), avatar: avatarData };
  const nextLevelProgress = learning.nextLevelAt
    ? Math.min(100, Math.round((learning.points / learning.nextLevelAt) * 100))
    : 100;
  const achievements = learning.achievements || [];
  const unlockedCount = achievements.filter((item) => item.unlocked).length;
  const isDirty = name !== (data?.user?.full_name || "")
    || bio !== (data?.profile?.bio || "")
    || optIn !== Boolean(data?.profile?.hallOfFameOptIn)
    || avatarData !== (data?.profile?.avatar || data?.user?.avatar || "");

  return (
    <ContentContainer>
      <PageHeader
        eyebrow="Prestasi"
        title="Profil & prestasi"
        description="Identitas belajar, pencapaian, dan preferensi akun Anda."
      />

      <Surface tone="green" className="aapm-profile-hero">
        <ProfileAvatar user={profileUser} name={profileName} className="aapm-profile-hero__avatar" fallbackClassName="bg-background text-xl text-brand-green" />
        <div className="min-w-0">
          <Badge variant="soft" hue="green" icon="award">{learning.level || "Level belajar"}</Badge>
          <h2 className="aapm-profile-hero__name">{profileName}</h2>
          <p className="aapm-profile-hero__email">{data?.user?.email}</p>
        </div>
        <div className="aapm-profile-hero__progress">
          <ProgressRing value={nextLevelProgress} size={76} stroke={7} hue="orange" label="Menuju level berikutnya" />
          <p className="aapm-profile-hero__progress-text">
            {learning.nextLevelAt ? `${learning.points || 0} / ${learning.nextLevelAt} poin` : "Level tertinggi tercapai"}
          </p>
        </div>
      </Surface>

      <KPICluster
        className="aapm-profile-kpi"
        label="Ringkasan profil belajar"
        columns={4}
        variant="cards"
        items={[
          {
            icon: "book",
            label: "Modul selesai",
            value: String(learning.completedModules || 0),
            note: `${learning.progressPercent || 0}% dari kurikulum`,
            tone: "success",
            colorway: 1,
            emphasis: "solid",
          },
          {
            icon: "analytics",
            label: "Rata-rata kuis",
            value: learning.quizAverage === null || learning.quizAverage === undefined ? "—" : `${learning.quizAverage}%`,
            note: "Dihitung dari nilai tersimpan",
            tone: "info",
            colorway: 2,
            emphasis: "solid",
          },
          {
            icon: "clock",
            label: "Waktu belajar",
            value: `${Math.floor((learning.timeSpentMinutes || 0) / 60)}j`,
            note: `${(learning.timeSpentMinutes || 0) % 60} menit tercatat`,
            tone: "warning",
            colorway: 3,
            emphasis: "solid",
          },
          {
            icon: "approve",
            label: "Sertifikat",
            value: String(learning.certificateCount || 0),
            note: "Diterbitkan oleh Academy",
            tone: "accent",
            colorway: 4,
            emphasis: "solid",
          },
        ]}
      />

      <Tabs defaultValue="summary" className="aapm-profile-tabs">
        <TabsList variant="underline" aria-label="Bagian profil">
          <TabsTrigger value="summary" icon="award">Ringkasan</TabsTrigger>
          <TabsTrigger value="profile" icon="user">Profil</TabsTrigger>
          <TabsTrigger value="appi" icon="ai">APPI</TabsTrigger>
          <TabsTrigger value="device" icon="smartphone">Perangkat</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="aapm-profile-summary">
          <Surface className="p-5 sm:p-6">
            <SectionHeader
              title="Pencapaian Anda"
              description={data?.achievementNote}
              actions={<Badge variant="soft" hue="green">{unlockedCount}/{achievements.length} terbuka</Badge>}
            />
            {achievements.length ? (
              <div className="aapm-achievement-grid">
                {achievements.map((achievement) => {
                  const percent = achievement.target ? Math.min(100, Math.round((Math.min(achievement.current, achievement.target) / achievement.target) * 100)) : 0;
                  return (
                    <article key={achievement.id} className="aapm-achievement" data-unlocked={achievement.unlocked ? "true" : "false"}>
                      <IconTile icon={achievement.icon} hue={achievement.unlocked ? "green" : "neutral"} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold">{achievement.title}</h3>
                          {achievement.unlocked ? <AapmIcon name="check" className="h-4 w-4 text-brand-green" /> : null}
                        </div>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">{achievement.description}</p>
                        <Progress className="mt-3" value={percent} size="sm" hue={achievement.unlocked ? "green" : "neutral"} label={`${achievement.title} ${percent}%`} />
                        <p className="mt-1.5 text-[11px] font-medium tabular-nums text-muted-foreground">{Math.min(achievement.current, achievement.target)}/{achievement.target}</p>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <StateView kind="empty" icon="award" title="Pencapaian belum tersedia" description="Pencapaian akan muncul setelah aktivitas belajar tercatat." framed={false} />
            )}
          </Surface>

          <Surface className="p-5 sm:p-6">
            <SectionHeader
              title="Hall of Fame"
              description={hall?.criteria}
            />
            <div className="aapm-hof-list">
              {hall?.entries?.length ? hall.entries.slice(0, 5).map((entry) => (
                <div key={entry.userId} className="aapm-hof-row">
                  <span className="aapm-hof-row__rank">{entry.rank}</span>
                  <span className="aapm-hof-row__avatar" aria-hidden="true">{entry.name.slice(0, 1).toUpperCase()}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{entry.name}</span>
                    <span className="block text-xs text-muted-foreground">{entry.level}</span>
                  </span>
                  <span className="text-sm font-semibold tabular-nums">{entry.points}</span>
                </div>
              )) : (
                <p className="aapm-hof-empty">Belum ada peserta yang memilih tampil di Hall of Fame.</p>
              )}
            </div>
          </Surface>
        </TabsContent>

        <TabsContent value="profile">
          <Surface className="aapm-profile-panel p-5 sm:p-6">
            <FormSection title="Foto profil" description="Foto dipotong persegi dan disimpan aman di akun Anda.">
              <div className="aapm-profile-avatar-row">
                <ProfileAvatar user={profileUser} name={profileName} className="h-16 w-16" fallbackClassName="bg-tint-green text-lg text-brand-green" />
                <div className="aapm-profile-avatar-row__actions">
                  <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Pilih foto profil" onChange={handleAvatarSelection} className="sr-only" />
                  <Button type="button" variant="outline" size="sm" leadingIcon="camera" onClick={() => avatarInputRef.current?.click()}>
                    {avatarData ? "Ganti foto" : "Tambah foto"}
                  </Button>
                  {avatarData ? <Button type="button" variant="ghost" size="sm" onClick={() => { setAvatarData(""); setAvatarError(""); }}>Hapus</Button> : null}
                </div>
              </div>
              {avatarError ? <p className="aapm-field-error" role="alert">{avatarError}</p> : null}
            </FormSection>

            <FormSection title="Identitas" description="Nama dan tentang saya tampil di ruang belajar.">
              <FormGrid columns={1}>
                <Field id="profile-name" label="Nama tampil">
                  <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={160} />
                </Field>
                <Field id="profile-bio" label="Tentang saya" hint="Opsional. Fokus belajar atau konteks farm yang ingin Anda bagikan.">
                  <Textarea value={bio} onChange={(event) => setBio(event.target.value)} maxLength={600} rows={3} placeholder="Ceritakan fokus belajar atau farm Anda." />
                </Field>
              </FormGrid>
            </FormSection>

            <FormSection title="Privasi" description="Kendalikan apa yang terlihat oleh peserta lain.">
              <SwitchField
                id="profile-hall-of-fame"
                label="Tampilkan di Hall of Fame"
                description="Hanya nama, level, dan poin pembelajaran yang ditampilkan. Email tidak pernah ditampilkan."
                checked={optIn}
                onCheckedChange={setOptIn}
              />
            </FormSection>

            <FormActions className="aapm-profile-panel__actions">
              <span className="aapm-profile-panel__status" aria-live="polite">{isDirty ? "Ada perubahan belum disimpan" : "Semua perubahan tersimpan"}</span>
              <Button type="button" onClick={save} loading={saveProfile.isPending} disabled={!isDirty}>Simpan profil</Button>
            </FormActions>
          </Surface>
        </TabsContent>

        <TabsContent value="appi">
          <AiAccountPreferences />
        </TabsContent>

        <TabsContent value="device">
          <PwaInstallShortcut />
        </TabsContent>
      </Tabs>
    </ContentContainer>
  );
}
