import React, { useState } from 'react';

interface LeadAIAnalysisFullscreenDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  subtitle?: string;
  content: string;
  briefingContent?: string | null;
  mediaItems?: LeadAIMediaItem[];
  isLoading?: boolean;
  copied: boolean;
}

const LeadAIAnalysisFullscreenDialog: React.FC<LeadAIAnalysisFullscreenDialogProps> = ({
  open,
  onOpenChange,
  title,
  subtitle,
  content,
  briefingContent,
  mediaItems,
  isLoading,
  copied,
}) => {
  const [showButtons, setShowButtons] = useState<'add' | 'new' | null>(null);

  const handleButtonClick = (button: 'add' | 'new') => {
    setShowButtons(button);
  };

  return (
    <div>
      <button
        onClick={() => handleButtonClick('add')}
        style={{ display: showButtons === 'add' ? 'none' : 'block' }}
      >
        Adicionar lead
      </button>
      <button
        onClick={() => handleButtonClick('new')}
        style={{ display: showButtons === 'new' ? 'none' : 'block' }}
      >
        Novo lead
      </button>
    </div>
  );
};

export default LeadAIAnalysisFullscreenDialog;
