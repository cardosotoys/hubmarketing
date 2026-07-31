import { useOnlineStatus } from '../hooks/useOnlineStatus';

// Avisa quando os dados na tela são os últimos salvos em cache (service worker), não os atuais —
// sem isso a pessoa pode achar que está vendo informação em tempo real estando offline.
export default function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div className="offline-banner">
      Sem conexão — mostrando os últimos dados salvos. Criar e editar volta a funcionar quando a
      internet voltar.
    </div>
  );
}
