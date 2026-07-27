export default function CampaignComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h2 style={{ fontFamily: 'Space Grotesk', fontSize: 17, margin: '0 0 8px 0' }}>{title}</h2>
      <div className="locked-banner">
        <span className="ic">🔒</span>
        {description}
      </div>
    </div>
  );
}
