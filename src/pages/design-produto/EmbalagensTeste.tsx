import Embalagens from './Embalagens';
import { PACKAGING_TRACKS_TESTE } from '../../types/database';

// Módulo isolado "Embalagens (Teste)" — mesma estrutura do Embalagens, mas com trilhas
// próprias (*_teste), pra receber a importação da Conferência de Embalagens sem afetar o real.
export default function EmbalagensTeste() {
  return <Embalagens tracks={PACKAGING_TRACKS_TESTE} moduleTitle="Embalagens (Teste)" />;
}
