import { useEffect } from 'react';
import { ArrowDown, ArrowUpRight, GraduationCap, Play, ShieldCheck, Sparkles } from 'lucide-react';
import { LandingForm } from '../features/leads/LandingForm';
import { useReveal } from '../features/catalog/motion';
import { useSurfaceLight } from '../shared/useSurfaceLight';
import './Landing.css';

export function Landing() {
  const revealRef = useReveal();
  const light = useSurfaceLight();
  useEffect(() => {
    document.title = 'LaPreDigital · Admisión UNT';
  }, []);
  return (
    <div className="landing" ref={revealRef} id="inicio">
      <a className="landing-skip" href="#contacto">
        Ir al formulario de contacto
      </a>
      <div className="landing-atmosphere" aria-hidden="true">
        <div className="landing-orbit">
          <span />
          <span />
          <span />
        </div>
      </div>
      <header className="landing-nav">
        <a className="landing-brand" href="#inicio" aria-label="LaPreDigital, inicio">
          <span className="landing-brand-mark">
            <GraduationCap size={25} strokeWidth={1.8} aria-hidden="true" />
          </span>
          <span>
            LaPre<span className="landing-brand-accent">Digital</span>
          </span>
        </a>
        <nav aria-label="Navegación principal">
          <a className="landing-nav-link" href="#presentacion">
            Conócenos
          </a>
          <a className="landing-nav-cta" href="#contacto">
            Quiero empezar <ArrowUpRight size={17} aria-hidden="true" />
          </a>
        </nav>
      </header>
      <main className="landing-main">
        <div className="landing-story">
          <section {...light} className="landing-copy" aria-labelledby="landing-title" data-reveal>
            <div className="landing-eyebrow">
              <Sparkles size={15} aria-hidden="true" />
              PREPARACIÓN PARA ADMISIÓN UNT
            </div>
            <h1 id="landing-title">
              Tu próxima meta:
              <span>ingresar a la UNT.</span>
            </h1>
            <p className="landing-intro">
              Dale dirección a tu preparación con LaPreDigital. Conoce nuestra propuesta y
              conversemos sobre el plan que va contigo.
            </p>
            <div className="landing-actions">
              <a className="landing-primary-link" href="#contacto">
                Empezar mi preparación <ArrowUpRight size={19} aria-hidden="true" />
              </a>
              <a className="landing-video-link" href="#presentacion">
                <span>
                  <Play size={14} fill="currentColor" aria-hidden="true" />
                </span>
                Ver presentación
              </a>
            </div>
            <p className="landing-contact-note">
              <ShieldCheck size={15} aria-hidden="true" />
              Tú eliges por dónde conversamos.
            </p>
          </section>
          <section
            className="landing-presentation"
            id="presentacion"
            aria-labelledby="landing-video-title"
            data-reveal
          >
            <div className="landing-video-heading">
              <span className="landing-video-index" aria-hidden="true">
                <Play size={13} fill="currentColor" />
              </span>
              <h2 id="landing-video-title">Dale play a tu próxima meta</h2>
              <ArrowDown size={16} aria-hidden="true" />
            </div>
            <div className="landing-video">
              <video
                controls
                playsInline
                preload="metadata"
                src="/landing/video.mp4"
                aria-label="Video de presentación de LaPreDigital"
              >
                Tu navegador no puede reproducir este video.
              </video>
            </div>
            <div className="landing-video-caption">
              <span>LaPreDigital</span>
              <span>Preparación para el examen de admisión</span>
            </div>
          </section>
        </div>
        <section className="landing-card" id="contacto" aria-label="Formulario de contacto">
          <div className="landing-card-accent" aria-hidden="true" />
          <LandingForm />
        </section>
      </main>
      <footer className="landing-footer">
        <span>© {new Date().getFullYear()} LaPreDigital</span>
        <span>Tu preparación. Tu siguiente paso.</span>
        <a href="#inicio">
          Volver arriba <ArrowUpRight size={15} aria-hidden="true" />
        </a>
      </footer>
    </div>
  );
}
