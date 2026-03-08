import { useState, useEffect, useMemo } from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Star, Search, MessageCircle, Loader2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface LawyerProfile {
  user_id: string;
  full_name: string | null;
  nickname: string | null;
  avatar_url: string | null;
  profession: string | null;
  specialization: string[] | null;
  bio: string | null;
  avg_rating: number;
  review_count: number;
}

interface Review {
  id: string;
  client_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  client_name?: string;
}

const SPECIALIZATIONS = [
  'Все', 'Уголовное право', 'Гражданское право', 'Административное право',
  'Семейное право', 'Трудовое право', 'Налоговое право', 'Корпоративное право',
];

const PROFESSIONS = [
  { value: 'all', label: 'Все статусы' },
  { value: 'адвокат', label: 'Адвокат' },
  { value: 'юрист', label: 'Юрист' },
  { value: 'non_lawyer', label: 'Не юрист' },
];

const RATING_OPTIONS = [
  { value: '0', label: 'Любой рейтинг' },
  { value: '3', label: '⭐ 3+' },
  { value: '4', label: '⭐ 4+' },
  { value: '4.5', label: '⭐ 4.5+' },
];

export default function Lawyers() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [lawyers, setLawyers] = useState<LawyerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [specFilter, setSpecFilter] = useState('Все');
  const [profFilter, setProfFilter] = useState('all');
  const [ratingFilter, setRatingFilter] = useState('0');
  const [selectedLawyer, setSelectedLawyer] = useState<LawyerProfile | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [newRating, setNewRating] = useState(5);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchLawyers();
  }, []);

  const fetchLawyers = async () => {
    setLoading(true);
    // Get all profiles with profession containing "юрист" or "адвокат"
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('user_id, full_name, nickname, avatar_url, profession, specialization, bio');

    if (error) {
      toast.error('Ошибка загрузки юристов');
      console.error(error);
      setLoading(false);
      return;
    }

    const lawyerProfiles = (profiles || []).filter(p =>
      p.profession && ['адвокат', 'юрист'].some(t => p.profession!.toLowerCase().includes(t))
    );

    // Get ratings
    const { data: reviewData } = await supabase.from('reviews').select('lawyer_id, rating');
    const ratingMap: Record<string, { sum: number; count: number }> = {};
    (reviewData || []).forEach((r: any) => {
      if (!ratingMap[r.lawyer_id]) ratingMap[r.lawyer_id] = { sum: 0, count: 0 };
      ratingMap[r.lawyer_id].sum += r.rating;
      ratingMap[r.lawyer_id].count += 1;
    });

    const result: LawyerProfile[] = lawyerProfiles.map(p => ({
      ...p,
      avg_rating: ratingMap[p.user_id] ? ratingMap[p.user_id].sum / ratingMap[p.user_id].count : 0,
      review_count: ratingMap[p.user_id]?.count || 0,
    }));

    result.sort((a, b) => b.avg_rating - a.avg_rating || b.review_count - a.review_count);
    setLawyers(result);
    setLoading(false);
  };

  const filteredLawyers = useMemo(() => {
    return lawyers.filter(l => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const name = (l.full_name || l.nickname || '').toLowerCase();
        if (!name.includes(q)) return false;
      }
      if (specFilter !== 'Все') {
        if (!l.specialization?.some(s => s.includes(specFilter))) return false;
      }
      return true;
    });
  }, [lawyers, searchQuery, specFilter]);

  const openLawyerProfile = async (lawyer: LawyerProfile) => {
    setSelectedLawyer(lawyer);
    setReviewsLoading(true);
    const { data } = await supabase
      .from('reviews')
      .select('*')
      .eq('lawyer_id', lawyer.user_id)
      .order('created_at', { ascending: false });

    // Get client names
    const clientIds = (data || []).map((r: any) => r.client_id);
    let clientMap: Record<string, string> = {};
    if (clientIds.length > 0) {
      const { data: clientProfiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, nickname')
        .in('user_id', clientIds);
      (clientProfiles || []).forEach((p: any) => {
        clientMap[p.user_id] = p.full_name || p.nickname || 'Аноним';
      });
    }

    setReviews((data || []).map((r: any) => ({ ...r, client_name: clientMap[r.client_id] || 'Аноним' })));
    setReviewsLoading(false);
  };

  const submitReview = async () => {
    if (!user || !selectedLawyer) return;
    if (selectedLawyer.user_id === user.id) {
      toast.error('Нельзя оставить отзыв самому себе');
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from('reviews').upsert({
      lawyer_id: selectedLawyer.user_id,
      client_id: user.id,
      rating: newRating,
      comment: newComment || null,
    }, { onConflict: 'lawyer_id,client_id' });

    if (error) {
      toast.error('Ошибка отправки отзыва');
      console.error(error);
    } else {
      toast.success('Отзыв сохранён');
      setShowReviewForm(false);
      setNewComment('');
      setNewRating(5);
      openLawyerProfile(selectedLawyer);
      fetchLawyers();
    }
    setSubmitting(false);
  };

  const startChat = (lawyerId: string) => {
    navigate(`/chat?to=${lawyerId}`);
  };

  const renderStars = (rating: number, interactive = false, onSelect?: (r: number) => void) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map(i => (
          <Star
            key={i}
            className={`h-4 w-4 ${i <= Math.round(rating) ? 'text-secondary fill-secondary' : 'text-muted-foreground/30'} ${interactive ? 'cursor-pointer hover:scale-110 transition-transform' : ''}`}
            onClick={() => interactive && onSelect?.(i)}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container mx-auto px-3 sm:px-4 py-6 sm:py-8 md:py-12">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <Users className="h-7 w-7 text-secondary" />
            <h1 className="text-2xl font-serif font-bold text-foreground">Юристы</h1>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-2 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Поиск по имени..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={specFilter} onValueChange={setSpecFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SPECIALIZATIONS.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredLawyers.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-40" />
                <p className="text-lg font-medium">Юристы не найдены</p>
                <p className="text-sm mt-1">Попробуйте изменить параметры поиска</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {filteredLawyers.map(lawyer => (
                <Card key={lawyer.user_id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => openLawyerProfile(lawyer)}>
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex items-start gap-4">
                      <Avatar className="h-12 w-12 shrink-0">
                        <AvatarImage src={lawyer.avatar_url || ''} />
                        <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                          {(lawyer.full_name || lawyer.nickname || '?')[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                          <div>
                            <p className="font-semibold text-foreground">{lawyer.full_name || lawyer.nickname || 'Без имени'}</p>
                            {lawyer.nickname && lawyer.full_name && (
                              <p className="text-xs text-muted-foreground">@{lawyer.nickname}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {renderStars(lawyer.avg_rating)}
                            <span className="text-xs text-muted-foreground">
                              {lawyer.avg_rating > 0 ? lawyer.avg_rating.toFixed(1) : '—'} ({lawyer.review_count})
                            </span>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{lawyer.profession}</p>
                        {lawyer.specialization && lawyer.specialization.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {lawyer.specialization.map(s => (
                              <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                            ))}
                          </div>
                        )}
                        {lawyer.bio && (
                          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{lawyer.bio}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />

      {/* Lawyer detail dialog */}
      <Dialog open={!!selectedLawyer} onOpenChange={open => { if (!open) { setSelectedLawyer(null); setShowReviewForm(false); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedLawyer && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={selectedLawyer.avatar_url || ''} />
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {(selectedLawyer.full_name || '?')[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p>{selectedLawyer.full_name || selectedLawyer.nickname}</p>
                    <p className="text-sm font-normal text-muted-foreground">{selectedLawyer.profession}</p>
                  </div>
                </DialogTitle>
                <DialogDescription>
                  {selectedLawyer.bio || 'Информация о юристе'}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Rating summary */}
                <div className="flex items-center gap-3">
                  {renderStars(selectedLawyer.avg_rating)}
                  <span className="text-sm text-muted-foreground">
                    {selectedLawyer.avg_rating > 0 ? selectedLawyer.avg_rating.toFixed(1) : 'Нет оценок'} · {selectedLawyer.review_count} отзыв(ов)
                  </span>
                </div>

                {/* Specializations */}
                {selectedLawyer.specialization && selectedLawyer.specialization.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {selectedLawyer.specialization.map(s => (
                      <Badge key={s} variant="secondary">{s}</Badge>
                    ))}
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-2">
                  <Button onClick={() => startChat(selectedLawyer.user_id)} className="gap-2">
                    <MessageCircle className="h-4 w-4" /> Написать
                  </Button>
                  <Button variant="outline" onClick={() => setShowReviewForm(!showReviewForm)} className="gap-2">
                    <Star className="h-4 w-4" /> Оставить отзыв
                  </Button>
                </div>

                {/* Review form */}
                {showReviewForm && (
                  <Card>
                    <CardContent className="p-4 space-y-3">
                      <div>
                        <p className="text-sm font-medium mb-1">Ваша оценка</p>
                        {renderStars(newRating, true, setNewRating)}
                      </div>
                      <Textarea
                        placeholder="Комментарий (необязательно)..."
                        value={newComment}
                        onChange={e => setNewComment(e.target.value)}
                        rows={3}
                      />
                      <Button onClick={submitReview} disabled={submitting} size="sm">
                        {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                        Отправить
                      </Button>
                    </CardContent>
                  </Card>
                )}

                {/* Reviews list */}
                <div>
                  <h3 className="text-sm font-semibold mb-3">Отзывы</h3>
                  {reviewsLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  ) : reviews.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Пока нет отзывов</p>
                  ) : (
                    <div className="space-y-3">
                      {reviews.map(review => (
                        <div key={review.id} className="border rounded-lg p-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium">{review.client_name}</span>
                            {renderStars(review.rating)}
                          </div>
                          {review.comment && (
                            <p className="text-sm text-muted-foreground mt-1">{review.comment}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(review.created_at).toLocaleDateString('ru-RU')}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
