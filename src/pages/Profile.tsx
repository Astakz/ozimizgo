import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { Loader2, Pencil, Save, X, Camera, User, Mail, Briefcase, BookOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const SPEC_KEYS = ['spec.criminal', 'spec.civil', 'spec.admin', 'spec.family', 'spec.labor', 'spec.tax', 'spec.corporate', 'spec.other'] as const;

interface ProfileData {
  full_name: string | null;
  nickname: string | null;
  email: string;
  avatar_url: string | null;
  bio: string | null;
  profession: string | null;
  specialization: string[] | null;
}

const Profile = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState('');
  const [nickname, setNickname] = useState('');
  const [bio, setBio] = useState('');
  const [profession, setProfession] = useState('');
  const [specialization, setSpecialization] = useState<string[]>([]);

  useEffect(() => { if (user) fetchProfile(); }, [user]);

  const fetchProfile = async () => {
    const { data, error } = await supabase.from('profiles').select('full_name, nickname, email, avatar_url, bio, profession, specialization').eq('user_id', user!.id).maybeSingle();
    if (error) toast({ title: t('common.error'), description: t('profile.loadError'), variant: 'destructive' });
    else if (data) {
      setProfile(data);
      setFullName(data.full_name || ''); setNickname(data.nickname || '');
      setBio(data.bio || ''); setProfession(data.profession || '');
      setSpecialization(data.specialization || []);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!nickname.trim()) { toast({ title: t('common.error'), description: t('profile.usernameEmpty'), variant: 'destructive' }); return; }
    const { data: isUnique } = await supabase.rpc('is_nickname_unique', { check_nickname: nickname.trim(), exclude_user_id: user!.id });
    if (!isUnique) { toast({ title: t('common.error'), description: t('profile.usernameTaken'), variant: 'destructive' }); return; }
    setSaving(true);
    const { error } = await supabase.from('profiles').update({ full_name: fullName.trim() || null, nickname: nickname.trim(), bio: bio.trim() || null, profession: profession || null, specialization: specialization.length > 0 ? specialization : null }).eq('user_id', user!.id);
    if (error) toast({ title: t('common.error'), description: t('profile.saveError'), variant: 'destructive' });
    else { toast({ title: t('profile.saved'), description: t('profile.profileUpdated') }); setEditing(false); fetchProfile(); }
    setSaving(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast({ title: t('common.error'), description: t('profile.photoMaxSize'), variant: 'destructive' }); return; }
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `${user!.id}/avatar.${ext}`;
    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (uploadError) { toast({ title: t('common.error'), description: t('profile.uploadError'), variant: 'destructive' }); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
    const { error: updateError } = await supabase.from('profiles').update({ avatar_url: urlData.publicUrl + '?t=' + Date.now() }).eq('user_id', user!.id);
    if (updateError) toast({ title: t('common.error'), description: t('profile.avatarError'), variant: 'destructive' });
    else { toast({ title: t('profile.done'), description: t('profile.photoUpdated') }); fetchProfile(); }
    setUploading(false);
  };

  const toggleSpecialization = (spec: string) => {
    setSpecialization((prev) => prev.includes(spec) ? prev.filter((s) => s !== spec) : [...prev, spec]);
  };

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-2xl">
        <Card className="shadow-elevated animate-fade-in">
          <CardHeader className="text-center pb-2">
            <div className="relative mx-auto mb-4">
              <Avatar className="w-24 h-24 md:w-32 md:h-32 border-4 border-primary/10">
                <AvatarImage src={profile?.avatar_url || undefined} />
                <AvatarFallback className="bg-primary text-primary-foreground text-2xl md:text-3xl">{getInitials(profile?.full_name)}</AvatarFallback>
              </Avatar>
              <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md hover:bg-primary/90 transition-colors">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            </div>
            <CardTitle className="text-2xl">{profile?.full_name || t('profile.noName')}</CardTitle>
            {profile?.nickname && <p className="text-muted-foreground">@{profile.nickname}</p>}
          </CardHeader>

          <CardContent className="space-y-6">
            {!editing ? (
              <>
                <div className="space-y-4">
                  <InfoRow icon={<Mail className="w-4 h-4" />} label={t('profile.email')} value={profile?.email || '—'} />
                  <InfoRow icon={<Briefcase className="w-4 h-4" />} label={t('profile.profession')} value={profile?.profession || '—'} />
                  <InfoRow icon={<BookOpen className="w-4 h-4" />} label={t('profile.about')} value={profile?.bio || '—'} />
                  <div className="flex items-start gap-3">
                    <User className="w-4 h-4 mt-1 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-sm text-muted-foreground">{t('profile.specialization')}</p>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {profile?.specialization && profile.specialization.length > 0 ? profile.specialization.map((s) => <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>) : <span className="text-sm text-foreground">—</span>}
                      </div>
                    </div>
                  </div>
                </div>
                <Button onClick={() => setEditing(true)} className="w-full"><Pencil className="w-4 h-4 mr-2" /> {t('profile.edit')}</Button>
              </>
            ) : (
              <>
                <div className="space-y-4">
                  <div className="space-y-2"><Label htmlFor="fullName">{t('profile.fullName')}</Label><Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
                  <div className="space-y-2"><Label htmlFor="nickname">{t('profile.username')}</Label><Input id="nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} /></div>
                  <div className="space-y-2">
                    <Label>{t('profile.profession')}</Label>
                    <Select value={profession} onValueChange={setProfession}>
                      <SelectTrigger><SelectValue placeholder={t('register.professionPlaceholder')} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Юрист">{t('register.lawyer')}</SelectItem>
                        <SelectItem value="Адвокат">{t('register.advocate')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('profile.specialization')}</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {SPEC_KEYS.map((specKey) => {
                        const label = t(specKey);
                        return (
                          <label key={specKey} className="flex items-center gap-2 cursor-pointer p-2 rounded-md hover:bg-muted transition-colors">
                            <Checkbox checked={specialization.includes(label)} onCheckedChange={() => toggleSpecialization(label)} />
                            <span className="text-sm">{label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  <div className="space-y-2"><Label htmlFor="bio">{t('profile.about')}</Label><Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} placeholder={t('profile.aboutPlaceholder')} rows={4} /></div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSave} disabled={saving} className="flex-1">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}{t('profile.save')}
                  </Button>
                  <Button variant="outline" onClick={() => { setEditing(false); if (profile) { setFullName(profile.full_name || ''); setNickname(profile.nickname || ''); setBio(profile.bio || ''); setProfession(profile.profession || ''); setSpecialization(profile.specialization || []); } }}>
                    <X className="w-4 h-4 mr-2" /> {t('profile.cancel')}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

const InfoRow = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="flex items-start gap-3">
    <span className="mt-1 text-muted-foreground shrink-0">{icon}</span>
    <div><p className="text-sm text-muted-foreground">{label}</p><p className="text-sm text-foreground">{value}</p></div>
  </div>
);

export default Profile;
