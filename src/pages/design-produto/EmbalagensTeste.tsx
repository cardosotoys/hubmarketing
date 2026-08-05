import Embalagens from './Embalagens';
import { PACKAGING_TRACKS_TESTE } from '../../types/database';

// Módulo "Embalagens" (dentro de Design de Produto). Usa as trilhas *_teste, que receberam a
// importação da Conferência de Embalagens do Monday.
export default function EmbalagensTeste() {
  return <Embalagens tracks={PACKAGING_TRACKS_TESTE} moduleTitle="Embalagens" />;
}
