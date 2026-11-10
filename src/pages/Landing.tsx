import { useEffect } from 'react';
import { LandingForm } from '../features/leads/LandingForm';
import './Landing.css';

export function Landing() {
  useEffect(() => {
    document.title = 'LaPreDigital · Admisión UNT';
  }, []);
  return (
    <div className="landing">
      <div className="landing-band">
        <header className="landing-header">
          <span className="landing-brand">LaPreDigital</span>
          <h1>Prepárate para el examen de admisión de la UNT</h1>
          <p>Mira el video y déjanos tus datos para ayudarte a empezar.</p>
        </header>
      </div>
      <main className="landing-main">
        <section className="landing-video" aria-label="Video de presentación">
          <video controls playsInline preload="metadata" src="/landing/video.mp4">
            Tu navegador no puede reproducir este video.
          </video>
        </section>
        <section className="landing-card" aria-label="Formulario de contacto">
          <LandingForm />
        </section>
      </main>
      <footer className="landing-footer">© 2026 LaPreDigital</footer>
    </div>
  );
}
