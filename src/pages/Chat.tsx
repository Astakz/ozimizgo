import { useState, useEffect, useRef } from 'react';
import { Header } from '@/components/Header';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageCircle, Send, Loader2, ArrowLeft, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useSearchParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

interface ChatContact {
  user_id: string;
  full_name: string | null;
  nickname: string | null;
  avatar_url: string | null;
  profession: string | null;
  last_message?: string;
  last_message_at?: string;
  unread_count?: number;
}

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  message_text: string;
  created_at: string;
  is_read: boolean;
}

export default function Chat() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [searchParams] = useSearchParams();
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [activeContact, setActiveContact] = useState<ChatContact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showContacts, setShowContacts] = useState(true);

  useEffect(() => {
    if (user) {
      fetchContacts();
    }
  }, [user]);

  // Handle ?to= parameter
  useEffect(() => {
    const toUserId = searchParams.get('to');
    if (toUserId && user) {
      loadContactFromId(toUserId);
    }
  }, [searchParams, user]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('chat-messages')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      }, (payload) => {
        const msg = payload.new as Message;
        if (msg.sender_id === user.id || msg.receiver_id === user.id) {
          if (activeContact && (msg.sender_id === activeContact.user_id || msg.receiver_id === activeContact.user_id)) {
            setMessages(prev => [...prev, msg]);
          }
          fetchContacts();
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, activeContact]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchContacts = async () => {
    if (!user) return;
    setLoading(true);

    // Get all messages involving user
    const { data: msgs } = await supabase
      .from('messages')
      .select('*')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: false });

    // Build contact list from messages
    const contactIds = new Set<string>();
    const contactLastMsg: Record<string, { text: string; at: string }> = {};
    const contactUnread: Record<string, number> = {};

    (msgs || []).forEach((m: any) => {
      const otherId = m.sender_id === user.id ? m.receiver_id : m.sender_id;
      contactIds.add(otherId);
      if (!contactLastMsg[otherId]) {
        contactLastMsg[otherId] = { text: m.message_text, at: m.created_at };
      }
      if (m.receiver_id === user.id && !m.is_read) {
        contactUnread[otherId] = (contactUnread[otherId] || 0) + 1;
      }
    });

    if (contactIds.size > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, nickname, avatar_url, profession')
        .in('user_id', [...contactIds]);

      const contactList: ChatContact[] = (profiles || []).map((p: any) => ({
        ...p,
        last_message: contactLastMsg[p.user_id]?.text,
        last_message_at: contactLastMsg[p.user_id]?.at,
        unread_count: contactUnread[p.user_id] || 0,
      }));

      contactList.sort((a, b) => {
        const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
        const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
        return bTime - aTime;
      });

      setContacts(contactList);
    } else {
      setContacts([]);
    }
    setLoading(false);
  };

  const loadContactFromId = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('user_id, full_name, nickname, avatar_url, profession')
      .eq('user_id', userId)
      .single();

    if (data) {
      const contact: ChatContact = { ...(data as any), last_message: undefined, last_message_at: undefined, unread_count: 0 };
      setActiveContact(contact);
      setShowContacts(false);
      loadMessages(userId);
      // Add to contacts if not already there
      setContacts(prev => {
        if (prev.find(c => c.user_id === userId)) return prev;
        return [contact, ...prev];
      });
    }
  };

  const loadMessages = async (contactId: string) => {
    if (!user) return;
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${contactId}),and(sender_id.eq.${contactId},receiver_id.eq.${user.id})`)
      .order('created_at', { ascending: true });

    setMessages((data || []) as Message[]);

    // Mark as read
    await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('sender_id', contactId)
      .eq('receiver_id', user.id)
      .eq('is_read', false);
  };

  const selectContact = (contact: ChatContact) => {
    setActiveContact(contact);
    setShowContacts(false);
    loadMessages(contact.user_id);
  };

  const sendMessage = async () => {
    if (!user || !activeContact || !messageText.trim()) return;
    setSending(true);
    const { error } = await supabase.from('messages').insert({
      sender_id: user.id,
      receiver_id: activeContact.user_id,
      message_text: messageText.trim(),
    });
    if (error) {
      toast.error('Ошибка отправки');
      console.error(error);
    } else {
      setMessageText('');
    }
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const filteredContacts = contactSearch
    ? contacts.filter(c => (c.full_name || c.nickname || '').toLowerCase().includes(contactSearch.toLowerCase()))
    : contacts;

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) {
      return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
  };

  const showContactsList = isMobile ? showContacts : true;
  const showChat = isMobile ? !showContacts : true;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container mx-auto px-0 sm:px-4 py-0 sm:py-4">
        <div className="max-w-5xl mx-auto h-[calc(100vh-4rem)] sm:h-[calc(100vh-8rem)] flex border rounded-none sm:rounded-lg overflow-hidden bg-card">
          {/* Contacts sidebar */}
          {showContactsList && (
            <div className={cn("flex flex-col border-r", isMobile ? "w-full" : "w-80 shrink-0")}>
              <div className="p-3 border-b">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Поиск..."
                    value={contactSearch}
                    onChange={e => setContactSearch(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>
              </div>
              <ScrollArea className="flex-1">
                {loading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredContacts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm px-4">
                    <MessageCircle className="h-10 w-10 mx-auto mb-2 opacity-40" />
                    <p>Нет сообщений</p>
                    <p className="text-xs mt-1">Начните чат со страницы юристов</p>
                  </div>
                ) : (
                  filteredContacts.map(contact => (
                    <button
                      key={contact.user_id}
                      onClick={() => selectContact(contact)}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left",
                        activeContact?.user_id === contact.user_id && "bg-muted"
                      )}
                    >
                      <Avatar className="h-10 w-10 shrink-0">
                        <AvatarImage src={contact.avatar_url || ''} />
                        <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                          {(contact.full_name || contact.nickname || '?')[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <p className="text-sm font-medium truncate">{contact.full_name || contact.nickname}</p>
                          {contact.last_message_at && (
                            <span className="text-xs text-muted-foreground shrink-0">{formatTime(contact.last_message_at)}</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-1">
                          <p className="text-xs text-muted-foreground truncate">{contact.last_message}</p>
                          {(contact.unread_count || 0) > 0 && (
                            <span className="shrink-0 h-5 min-w-5 rounded-full bg-secondary text-secondary-foreground text-xs flex items-center justify-center px-1">
                              {contact.unread_count}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </ScrollArea>
            </div>
          )}

          {/* Chat area */}
          {showChat && (
            <div className="flex flex-col flex-1 min-w-0">
              {activeContact ? (
                <>
                  {/* Chat header */}
                  <div className="flex items-center gap-3 p-3 border-b bg-card">
                    {isMobile && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setShowContacts(true)}>
                        <ArrowLeft className="h-4 w-4" />
                      </Button>
                    )}
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarImage src={activeContact.avatar_url || ''} />
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                        {(activeContact.full_name || '?')[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{activeContact.full_name || activeContact.nickname}</p>
                      <p className="text-xs text-muted-foreground">{activeContact.profession}</p>
                    </div>
                  </div>

                  {/* Messages */}
                  <ScrollArea className="flex-1 p-4">
                    <div className="space-y-3">
                      {messages.map(msg => {
                        const isMine = msg.sender_id === user?.id;
                        return (
                          <div key={msg.id} className={cn("flex", isMine ? "justify-end" : "justify-start")}>
                            <div className={cn(
                              "max-w-[80%] rounded-2xl px-4 py-2",
                              isMine
                                ? "bg-primary text-primary-foreground rounded-br-sm"
                                : "bg-muted rounded-bl-sm"
                            )}>
                              <p className="text-sm whitespace-pre-wrap break-words">{msg.message_text}</p>
                              <p className={cn("text-[10px] mt-1", isMine ? "text-primary-foreground/60" : "text-muted-foreground")}>
                                {formatTime(msg.created_at)}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </div>
                  </ScrollArea>

                  {/* Input */}
                  <div className="p-3 border-t bg-card">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Написать сообщение..."
                        value={messageText}
                        onChange={e => setMessageText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="flex-1"
                      />
                      <Button onClick={sendMessage} disabled={sending || !messageText.trim()} size="icon" className="shrink-0">
                        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <MessageCircle className="h-16 w-16 mx-auto mb-3 opacity-30" />
                    <p className="text-lg font-medium">Выберите чат</p>
                    <p className="text-sm mt-1">Или начните новый разговор со страницы юристов</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
