import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface NumeroNegativado {
  id: number;
  numeroTelefone: string;
}

export function useNumerosNegativados() {
  const [numeros, setNumeros] = useState<NumeroNegativado[]>([]);
  const [filteredNumeros, setFilteredNumeros] = useState<NumeroNegativado[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const fetchNumeros = async (search = '') => {
    setIsLoading(true);
    try {
      // Obter sessão atual para pegar o token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        throw new Error('Usuário não autenticado');
      }

      const { data, error } = await supabase.functions.invoke('listar-numeros-negativados', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      if (data?.success && data?.data) {
        setNumeros(data.data);
        setFilteredNumeros(data.data);
      } else {
        setNumeros([]);
        setFilteredNumeros([]);
      }
    } catch (error) {
      console.error('Erro ao buscar números:', error);
      toast.error('Erro ao buscar números negativados');
      setNumeros([]);
      setFilteredNumeros([]);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteNumero = async (id: number): Promise<boolean> => {
    try {
      // Obter sessão atual para pegar o token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        throw new Error('Usuário não autenticado');
      }

      const { data, error } = await supabase.functions.invoke('remover-numero-negativado', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: { id },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(`Número ${data.numeroRemovido} removido com sucesso!`);
        await fetchNumeros(searchTerm);
        return true;
      } else {
        throw new Error(data?.error || 'Erro ao remover número');
      }
    } catch (error) {
      console.error('Erro ao deletar número:', error);
      toast.error('Erro ao remover número. Tente novamente.');
      return false;
    }
  };

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    if (!term.trim()) {
      setFilteredNumeros(numeros);
    } else {
      const filtered = numeros.filter((numero) =>
        numero.numeroTelefone.toString().includes(term.trim())
      );
      setFilteredNumeros(filtered);
    }
  };

  const refreshNumeros = () => {
    fetchNumeros(searchTerm);
  };

  useEffect(() => {
    fetchNumeros();
  }, []);

  return {
    numeros: filteredNumeros,
    isLoading,
    searchTerm,
    setSearchTerm: handleSearch,
    deleteNumero,
    refreshNumeros,
  };
}
