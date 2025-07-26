"use client";

import React, { useState, useEffect, useRef } from 'react';
import { signInAnonymously, onAuthStateChanged, type User } from 'firebase/auth';
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, type Timestamp } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '@/lib/firebase';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SendHorizontal, AlertCircle, Loader2 } from 'lucide-react';

interface Message {
  id: string;
  text: string;
  userId: string;
  timestamp: Timestamp | null;
}

export function ChatRoom() {
  const [user, setUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scrollViewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setError("Firebase configuration is missing. Please check your environment variables.");
      setLoading(false);
      return;
    }

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        try {
          await signInAnonymously(auth);
        } catch (err: any) {
          console.error("Anonymous sign-in failed:", err);
          setError(`Authentication failed: ${err.message}`);
        }
      }
      setLoading(false);
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (db && user) {
      const studioAppId = process.env.NEXT_PUBLIC_STUDIO_APP_ID || 'default-app-id';
      const messagesCollectionPath = `artifacts/${studioAppId}/public/data/messages`;
      const messagesCollectionRef = collection(db, messagesCollectionPath);
      const q = query(messagesCollectionRef, orderBy("timestamp"));

      const unsubscribeMessages = onSnapshot(q, (snapshot) => {
        const fetchedMessages = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Message));
        setMessages(fetchedMessages);
      }, (err) => {
        console.error("Error fetching messages:", err);
        setError(`Failed to load messages: ${err.message}`);
      });

      return () => unsubscribeMessages();
    }
  }, [db, user]);

  useEffect(() => {
    if (scrollViewportRef.current) {
      scrollViewportRef.current.scrollTop = scrollViewportRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !user || !newMessage.trim()) return;

    const studioAppId = process.env.NEXT_PUBLIC_STUDIO_APP_ID || 'default-app-id';
    const messagesCollectionPath = `artifacts/${studioAppId}/public/data/messages`;

    try {
      await addDoc(collection(db, messagesCollectionPath), {
        text: newMessage,
        userId: user.uid,
        timestamp: serverTimestamp()
      });
      setNewMessage('');
    } catch (err: any) {
      console.error("Error sending message:", err);
      setError(`Failed to send message: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-lg text-muted-foreground">A carregar aplicação...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Alert variant="destructive" className="max-w-lg">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Ocorreu um erro</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <Card className="w-full max-w-2xl shadow-2xl">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center">Firebase Studio Chat</CardTitle>
          <CardDescription className="text-center text-muted-foreground">
            Uma aplicação de chat em tempo real.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-primary/10 p-3 rounded-lg text-sm text-foreground/80 break-words">
            Seu ID de Usuário: <span className="font-mono font-semibold">{user?.uid}</span>
          </div>
          <ScrollArea className="h-96 w-full rounded-md border">
            <div className="p-4" ref={scrollViewportRef}>
              <div className="space-y-4">
                {messages.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">Nenhuma mensagem ainda. Seja o primeiro!</p>
                ) : (
                  messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.userId === user?.uid ? 'justify-end' : 'justify-start'}`}>
                      <div className={`p-3 rounded-lg max-w-xs md:max-w-md shadow-sm ${msg.userId === user?.uid ? 'bg-primary/20' : 'bg-muted'}`}>
                        <p className="text-sm font-medium">{msg.text}</p>
                        <p className="text-xs text-muted-foreground mt-1 text-right">
                          <span className="font-mono" title={msg.userId}>{msg.userId.substring(0, 8)}...</span>
                          {' - '}
                          {msg.timestamp ? new Date(msg.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </ScrollArea>
        </CardContent>
        <CardFooter>
          <form onSubmit={handleSendMessage} className="flex w-full items-center space-x-2">
            <Input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Escreva uma mensagem..."
              className="flex-grow"
              required
              aria-label="New message"
            />
            <Button type="submit" className="bg-accent hover:bg-accent/90" aria-label="Enviar Mensagem">
              <SendHorizontal className="h-5 w-5" />
            </Button>
          </form>
        </CardFooter>
      </Card>
    </div>
  );
}
