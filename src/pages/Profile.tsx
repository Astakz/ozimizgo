import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Camera, Save, User, Briefcase, Mail, FileText } from 'lucide-react';
import { toast } from 'sonner';

const SPECIALIZATIONS = [
  { id: 'criminal', label: 'Уголовные дела' },
  { id: 'civil', label: 'Гражданские дела' },
  { id: 'administrative', label: 'Административные дела' },
  { id: 'other', label: 'Другие юридические направления' },
];

const PROFESSIONS = [
  { value: 'lawyer', label: 'Адвокат' },
  { value: 'jurist', label: 'Юрист' },
  { value: 'non_lawyer', label: 'Не юрист' },
];

export default function Profile() {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [fullName, setFullName] = useState('');
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [bio, setBio] = useState('');
  const [profession, setProfession] = useState('');
  const [specialization, setSpecialization] = useState<string[]>([]);
  const [avatarUrl, setAvatarUrl] = useState('');

  useEffect(() => {
    if (user) loadProfile();
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (data) {
      setFullName(data.full_name || data.name || '');
      setNickname(data.nickname || '');
      setEmail(data.email || '');
      setBio(data.bio || '');
      setProfession(data.profession || '');
      setSpecialization((data.specialization as string[]) || []);
      setAvatarUrl(data.avatar_url || '');
    }
    setLoading(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Пожалуйста, выберите изображение');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Размер файла не должен превышать 5 МБ');
      return;
    }

    setUploadingAvatar(true);
    try {
      const ext = file.name.split('.').pop();
      const filePath = `${user.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const url = `${publicUrl}?t=${Date.now()}`;
      setAvatarUrl(url);

      await supabase
        .from('profiles')
        .update({ avatar_url: url })
        .eq('user_id', user.id);

      toast.success('Фото профиля обновлено');
    } catch (err: any) {
      toast.error('Ошибка загрузки: ' + err.message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const [nicknameError, setNicknameError] = useState('');

  const checkNicknameUnique = async (value: string) => {
    if (!value.trim() || !user) return;
    const { data } = await supabase.rpc('is_nickname_unique', {
      check_nickname: value.trim(),
      exclude_user_id: user.id,
    });
    if (!data) {
      setNicknameError('Это имя пользователя уже занято');
    } else {
      setNicknameError('');
    }
  };

  const handleSave = async () => {
    if (!user) return;
    if (nicknameError) {
      toast.error('Исправьте ошибки перед сохранением');
      return;
    }
    setSaving(true);
    try {
      // Check uniqueness one more time
      if (nickname.trim()) {
        const { data: isUnique } = await supabase.rpc('is_nickname_unique', {
          check_nickname: nickname.trim(),
          exclude_user_id: user.id,
        });
        if (!isUnique) {
          toast.error('Имя пользователя уже занято');
          setSaving(false);
          return;
        }
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          nickname: nickname.trim(),
          bio,
          profession,
          specialization,
        })
        .eq('user_id', user.id);

      if (error) throw error;
      toast.success('Профиль сохранён');
    } catch (err: any) {
      toast.error('Ошибка сохранения: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleSpecialization = (id: string) => {
    setSpecialization(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const initials = (fullName || nickname || email || '?').slice(0, 2).toUpperCase();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-2xl">
        <h1 className="text-2xl font-bold text-foreground mb-6">Мой профиль</h1>

        {/* Avatar */}
        <Card className="mb-6">
          <CardContent className="flex items-center gap-6 py-6">
            <div className="relative group">
              <Avatar className="h-24 w-24 border-2 border-border">
                {avatarUrl ? (
                  <AvatarImage src={avatarUrl} alt="Аватар" />
                ) : null}
                <AvatarFallback className="text-xl font-semibold bg-muted text-muted-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute inset-0 flex items-center justify-center bg-foreground/50 text-primary-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Camera className="h-6 w-6" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-foreground truncate">
                {fullName || nickname || 'Пользователь'}
              </h2>
              <p className="text-sm text-muted-foreground truncate">{email}</p>
              {profession && (
                <Badge variant="secondary" className="mt-2">
                  {PROFESSIONS.find(p => p.value === profession)?.label || profession}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="h-5 w-5 text-primary" /> Личные данные
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Имя и фамилия</Label>
                <Input id="fullName" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Иван Иванов" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nickname">Никнейм</Label>
                <Input id="nickname" value={nickname} onChange={e => setNickname(e.target.value)} placeholder="ivan_law" />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Mail className="h-4 w-4 text-muted-foreground" /> Email</Label>
              <Input value={email} disabled className="bg-muted" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio" className="flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-muted-foreground" /> О себе
              </Label>
              <Textarea id="bio" value={bio} onChange={e => setBio(e.target.value)} placeholder="Расскажите о себе..." rows={3} />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Briefcase className="h-4 w-4 text-muted-foreground" /> Профессия
              </Label>
              <Select value={profession} onValueChange={setProfession}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите профессию" />
                </SelectTrigger>
                <SelectContent>
                  {PROFESSIONS.map(p => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label>Специализация</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {SPECIALIZATIONS.map(s => (
                  <label key={s.id} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={specialization.includes(s.id)}
                      onCheckedChange={() => toggleSpecialization(s.id)}
                    />
                    <span className="text-sm text-foreground">{s.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <Button onClick={handleSave} disabled={saving} className="w-full">
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Сохранение...' : 'Сохранить профиль'}
            </Button>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
