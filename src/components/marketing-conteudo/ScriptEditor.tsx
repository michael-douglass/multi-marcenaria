import { useState, useRef, useCallback, forwardRef, useImperativeHandle, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Bold, 
  Italic, 
  Maximize2, 
  Minimize2,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScriptEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  /**
   * Permite que o componente pai ajuste layout (ex: deixar o Dialog em tela cheia)
   * quando o editor entrar/sair do modo fullscreen.
   */
  onFullscreenChange?: (isFullscreen: boolean) => void;
}

export interface ScriptEditorRef {
  insertAtCursor: (text: string) => void;
}

// Convert plain text with syntax to HTML for display
function syntaxToHtml(text: string): string {
  if (!text) return '';
  
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold">$1</strong>')
    .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em class="italic">$1</em>')
    .replace(/::yellow::(.+?)::/g, '<mark class="bg-yellow-200 text-yellow-900 px-0.5 rounded">$1</mark>')
    .replace(/::green::(.+?)::/g, '<mark class="bg-green-200 text-green-900 px-0.5 rounded">$1</mark>')
    .replace(/::blue::(.+?)::/g, '<mark class="bg-blue-200 text-blue-900 px-0.5 rounded">$1</mark>')
    .replace(/::pink::(.+?)::/g, '<mark class="bg-pink-200 text-pink-900 px-0.5 rounded">$1</mark>')
    .replace(/::orange::(.+?)::/g, '<mark class="bg-orange-200 text-orange-900 px-0.5 rounded">$1</mark>')
    .replace(/::purple::(.+?)::/g, '<mark class="bg-purple-200 text-purple-900 px-0.5 rounded">$1</mark>');
  
  return html;
}

// Convert HTML back to plain text with syntax
function htmlToSyntax(html: string): string {
  if (!html) return '';
  
  const temp = document.createElement('div');
  temp.innerHTML = html;
  
  function processNode(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || '';
    }
    
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      const tagName = element.tagName.toLowerCase();
      
      let content = '';
      element.childNodes.forEach(child => {
        content += processNode(child);
      });
      
      if (tagName === 'br') return '\n';
      if (tagName === 'div' && element.previousSibling) return '\n' + content;
      if (tagName === 'strong' || tagName === 'b') return `**${content}**`;
      if (tagName === 'em' || tagName === 'i') return `*${content}*`;
      if (tagName === 'mark') {
        const className = element.className || '';
        if (className.includes('yellow')) return `::yellow::${content}::`;
        if (className.includes('green')) return `::green::${content}::`;
        if (className.includes('blue')) return `::blue::${content}::`;
        if (className.includes('pink')) return `::pink::${content}::`;
        if (className.includes('orange')) return `::orange::${content}::`;
        if (className.includes('purple')) return `::purple::${content}::`;
        return `::yellow::${content}::`;
      }
      
      return content;
    }
    
    return '';
  }
  
  let result = '';
  temp.childNodes.forEach(node => {
    result += processNode(node);
  });
  
  return result;
}

export const ScriptEditor = forwardRef<ScriptEditorRef, ScriptEditorProps>(
  ({ value, onChange, placeholder, className, onFullscreenChange }, ref) => {
    const [isFullscreen, setIsFullscreen] = useState(false);
    const editorRef = useRef<HTMLDivElement>(null);
    const lastValueRef = useRef(value);
    const isUserTyping = useRef(false);

    // Inicializa o HTML do editor apenas na montagem
    useEffect(() => {
      if (editorRef.current) {
        editorRef.current.innerHTML = syntaxToHtml(value);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Sync external value changes (ex: insertAtCursor, IA generation)
    // Só atualiza se NÃO for digitação do usuário e o valor for diferente
    useEffect(() => {
      const editor = editorRef.current;
      if (!editor) return;

      // Se o usuário está digitando, não fazer nada
      if (isUserTyping.current) {
        isUserTyping.current = false;
        lastValueRef.current = value;
        return;
      }

      // Se o valor não mudou, não fazer nada
      if (value === lastValueRef.current) return;

      // Valor mudou externamente (ex: inserção de mídia)
      const currentSyntax = htmlToSyntax(editor.innerHTML);
      if (currentSyntax !== value) {
        editor.innerHTML = syntaxToHtml(value);
      }
      lastValueRef.current = value;
    }, [value]);

    // Fullscreen sync
    useEffect(() => {
      onFullscreenChange?.(isFullscreen);
      if (isFullscreen) {
        requestAnimationFrame(() => {
          editorRef.current?.focus();
          // Coloca cursor no final
          const selection = window.getSelection();
          if (selection && editorRef.current) {
            const range = document.createRange();
            range.selectNodeContents(editorRef.current);
            range.collapse(false);
            selection.removeAllRanges();
            selection.addRange(range);
          }
        });
      }
    }, [isFullscreen, onFullscreenChange]);

    useImperativeHandle(ref, () => ({
      insertAtCursor: (text: string) => {
        const editor = editorRef.current;
        if (!editor) {
          onChange(value + text);
          return;
        }
        
        editor.focus();
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          range.deleteContents();
          range.insertNode(document.createTextNode(text));
          range.collapse(false);
          selection.removeAllRanges();
          selection.addRange(range);
          
          handleInput();
        } else {
          onChange(value + text);
        }
      }
    }));

    const handleInput = useCallback(() => {
      if (editorRef.current) {
        isUserTyping.current = true;
        const syntax = htmlToSyntax(editorRef.current.innerHTML);
        lastValueRef.current = syntax;
        onChange(syntax);
      }
    }, [onChange]);

    const applyFormat = useCallback((formatType: 'bold' | 'italic') => {
      const editor = editorRef.current;
      if (!editor) return;

      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;

      const range = selection.getRangeAt(0);
      const selectedText = range.toString();
      if (!selectedText) return;

      let wrapper: HTMLElement;
      if (formatType === 'bold') {
        wrapper = document.createElement('strong');
        wrapper.className = 'font-bold';
      } else {
        wrapper = document.createElement('em');
        wrapper.className = 'italic';
      }

      const fragment = range.extractContents();
      wrapper.appendChild(fragment);
      range.insertNode(wrapper);

      range.selectNodeContents(wrapper);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);

      handleInput();
    }, [handleInput]);

    const applyBold = useCallback(() => applyFormat('bold'), [applyFormat]);
    const applyItalic = useCallback(() => applyFormat('italic'), [applyFormat]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        applyBold();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
        e.preventDefault();
        applyItalic();
      }
    }, [applyBold, applyItalic]);

    const handlePaste = useCallback((e: React.ClipboardEvent) => {
      e.preventDefault();
      const text = e.clipboardData.getData('text/plain');
      document.execCommand('insertText', false, text);
    }, []);

    const ToolbarButton = ({ 
      onClick, 
      icon: Icon, 
      title
    }: { 
      onClick: () => void; 
      icon: React.ElementType; 
      title: string; 
    }) => (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onMouseDown={(e) => {
          e.preventDefault();
          onClick();
        }}
        className="h-7 w-7 p-0"
        title={title}
      >
        <Icon className="h-4 w-4" />
      </Button>
    );

    return (
      <div className={cn(
        "border rounded-lg overflow-hidden",
        isFullscreen 
          ? "fixed inset-0 z-[9999] bg-background flex flex-col" 
          : "relative",
        className
      )}>
        {/* Toolbar */}
        <div className="flex items-center gap-1 p-2 border-b bg-muted/30">
          <ToolbarButton onClick={applyBold} icon={Bold} title="Negrito (Ctrl+B)" />
          <ToolbarButton onClick={applyItalic} icon={Italic} title="Itálico (Ctrl+I)" />

          <div className="flex-1" />

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsFullscreen(v => !v)}
            className="h-7 px-2 gap-1"
            title={isFullscreen ? 'Minimizar' : 'Tela cheia'}
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="h-4 w-4" />
                <span className="text-xs hidden sm:inline">Minimizar</span>
              </>
            ) : (
              <>
                <Maximize2 className="h-4 w-4" />
                <span className="text-xs hidden sm:inline">Expandir</span>
              </>
            )}
          </Button>

          {isFullscreen && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsFullscreen(false)}
              className="h-7 w-7 p-0"
              title="Fechar"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Contenteditable Editor - NÃO usar dangerouslySetInnerHTML aqui */}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          data-placeholder={placeholder}
          className={cn(
            "outline-none focus:outline-none p-3 whitespace-pre-wrap break-words",
            "empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground empty:before:pointer-events-none",
            isFullscreen 
              ? "flex-1 min-h-0 overflow-y-auto text-base p-4" 
              : "min-h-[200px]"
          )}
          style={{ wordBreak: 'break-word' }}
        />

        {/* Help text */}
        {!isFullscreen && (
          <div className="px-3 py-2 border-t bg-muted/20">
            <p className="text-xs text-muted-foreground">
              Dica: Selecione o texto e clique no botão ou use Ctrl+B (negrito) e Ctrl+I (itálico).
            </p>
          </div>
        )}
      </div>
    );
  }
);

ScriptEditor.displayName = 'ScriptEditor';

/**
 * Renders formatted script content with bold, italic, and highlights
 * Use this to display the formatted content in read-only views
 */
export function renderFormattedScript(text: string): React.ReactNode {
  if (!text) return null;
  
  const parts: React.ReactNode[] = [];
  let currentIndex = 0;
  
  const formatRegex = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(::(\w+)::(.+?)::)/g;
  let match;
  
  while ((match = formatRegex.exec(text)) !== null) {
    if (match.index > currentIndex) {
      parts.push(text.substring(currentIndex, match.index));
    }
    
    if (match[1]) {
      parts.push(
        <strong key={`bold-${match.index}`} className="font-bold">
          {match[2]}
        </strong>
      );
    } else if (match[3]) {
      parts.push(
        <em key={`italic-${match.index}`} className="italic">
          {match[4]}
        </em>
      );
    } else if (match[5]) {
      const color = match[6];
      const content = match[7];
      const colorClass = getHighlightClass(color);
      parts.push(
        <mark 
          key={`highlight-${match.index}`} 
          className={cn("px-0.5 rounded", colorClass)}
        >
          {content}
        </mark>
      );
    }
    
    currentIndex = match.index + match[0].length;
  }
  
  if (currentIndex < text.length) {
    parts.push(text.substring(currentIndex));
  }
  
  return parts.length > 0 ? parts : text;
}

function getHighlightClass(color: string): string {
  const colorMap: Record<string, string> = {
    yellow: 'bg-yellow-200 text-yellow-900',
    green: 'bg-green-200 text-green-900',
    blue: 'bg-blue-200 text-blue-900',
    pink: 'bg-pink-200 text-pink-900',
    orange: 'bg-orange-200 text-orange-900',
    purple: 'bg-purple-200 text-purple-900',
  };
  return colorMap[color] || colorMap.yellow;
}
