import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { MessageCircle, X, Send, Bot, User, Loader2, Minimize2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface ChatbotProps {
  className?: string;
}

// Function to format message content with markdown-style formatting
function formatMessageContent(content: string): JSX.Element {
  // Split content into lines
  const lines = content.split('\n');
  const formattedLines: JSX.Element[] = [];
  let bulletCounter = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line.startsWith('* ')) {
      // Handle bullet points - convert to numbered list
      const bulletContent = line.substring(2); // Remove '* '
      const formattedContent = formatBoldText(bulletContent);
      
      formattedLines.push(
        <div key={i} className="flex items-start space-x-2 my-1">
          <span className="text-primary font-semibold min-w-[1.5rem]">{bulletCounter}.</span>
          <span>{formattedContent}</span>
        </div>
      );
      bulletCounter++;
    } else if (line) {
      // Handle regular text with bold formatting
      const formattedContent = formatBoldText(line);
      formattedLines.push(<div key={i} className="my-1">{formattedContent}</div>);
    } else {
      // Empty line
      formattedLines.push(<div key={i} className="h-2"></div>);
    }
  }

  return <div>{formattedLines}</div>;
}

// Function to convert **text** to bold
function formatBoldText(text: string): JSX.Element {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  
  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          // Bold text
          const boldText = part.slice(2, -2);
          return <strong key={index} className="font-semibold text-foreground">{boldText}</strong>;
        } else {
          // Regular text
          return <span key={index}>{part}</span>;
        }
      })}
    </>
  );
}

export function Chatbot({ className }: ChatbotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hello! I\'m your Clause2Case AI Assistant. I can help you navigate the platform, understand the test case generation workflow, and answer questions about your documents and test cases. What would you like to know?',
      timestamp: new Date().toISOString()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && !isMinimized && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, isMinimized]);

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      // Prepare conversation history for context
      const conversationHistory = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      const response = await apiRequest('POST', '/api/chat', {
        message: userMessage.content,
        conversationHistory
      });

      const responseData = await response.json() as { response: string; timestamp: string };

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: responseData.response,
        timestamp: responseData.timestamp
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'I apologize, but I encountered an error while processing your request. Please try again or contact support if the issue persists.',
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
      console.error('Chat error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const toggleChat = () => {
    setIsOpen(!isOpen);
    setIsMinimized(false);
  };

  const minimizeChat = () => {
    setIsMinimized(!isMinimized);
  };

  if (!isOpen) {
    return (
      <Button
        onClick={toggleChat}
        size="icon"
        className={cn(
          "rounded-full shadow-lg hover-elevate active-elevate-2",
          "bg-primary text-primary-foreground",
          "border-2 border-primary-border",
          className
        )}
        style={{ 
          position: 'fixed',
          bottom: '16px',
          right: '16px',
          top: 'auto',
          left: 'auto',
          width: '56px',
          height: '56px',
          zIndex: 9999
        }}
        data-testid="button-open-chat"
      >
        <MessageCircle className="h-6 w-6" />
      </Button>
    );
  }

  return (
    <Card
      className={cn(
        "shadow-xl transition-all duration-300",
        isMinimized ? "" : "",
        "bg-card border-card-border",
        className
      )}
      style={{ 
        position: 'fixed',
        bottom: '16px',
        right: '16px',
        top: 'auto',
        left: 'auto',
        width: '384px',
        height: isMinimized ? '64px' : '500px',
        zIndex: 9999
      }}
      data-testid="chatbot-window"
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 py-3 border-b border-card-border">
        <div className="flex items-center space-x-2">
          <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
            <Bot className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-sm font-medium">Clause2Case Assistant</CardTitle>
            <div className="flex items-center space-x-1">
              <div className="h-2 w-2 bg-green-500 rounded-full"></div>
              <span className="text-xs text-muted-foreground">Online</span>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={minimizeChat}
            className="h-8 w-8"
            data-testid="button-minimize-chat"
          >
            <Minimize2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleChat}
            className="h-8 w-8"
            data-testid="button-close-chat"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      {!isMinimized && (
        <CardContent className="p-0 flex flex-col h-full">
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex items-start space-x-2",
                    message.role === 'user' ? "justify-end" : "justify-start"
                  )}
                >
                  {message.role === 'assistant' && (
                    <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                      <Bot className="h-4 w-4 text-primary-foreground" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[280px] rounded-lg px-3 py-2 text-sm",
                      message.role === 'user'
                        ? "bg-primary text-primary-foreground ml-auto"
                        : "bg-muted text-foreground"
                    )}
                    data-testid={`message-${message.role}-${message.id}`}
                  >
                    <div className="leading-relaxed">{formatMessageContent(message.content)}</div>
                    <span className="text-xs opacity-70 block mt-1">
                      {new Date(message.timestamp).toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </span>
                  </div>
                  {message.role === 'user' && (
                    <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                      <User className="h-4 w-4 text-secondary-foreground" />
                    </div>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="flex items-start space-x-2">
                  <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <Bot className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <div className="bg-muted rounded-lg px-3 py-2">
                    <div className="flex items-center space-x-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">Thinking...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          <div className="p-4 border-t border-card-border">
            <div className="flex space-x-2">
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me anything about Clause2Case..."
                className="flex-1"
                disabled={isLoading}
                data-testid="input-chat-message"
              />
              <Button
                onClick={sendMessage}
                size="icon"
                disabled={!inputValue.trim() || isLoading}
                data-testid="button-send-message"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center space-x-1">
                <Badge variant="outline" className="text-xs">
                  Powered by Gemini 2.0
                </Badge>
              </div>
              <span className="text-xs text-muted-foreground">
                Press Enter to send
              </span>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}