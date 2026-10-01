'use client';
import React, { useState } from 'react';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useLegalLang, LegalLang } from '../../lib/legalLang';

interface FaqItem { q: string; a: string; }
interface FaqGroup { group: string; items: FaqItem[]; }
interface FaqContent { title: string; subtitle: string; groups: FaqGroup[]; }

const CONTENT: Record<LegalLang, FaqContent> = {
  pt: {
    title: 'Perguntas frequentes',
    subtitle: 'Respostas às dúvidas mais comuns sobre a plataforma, os planos e as ferramentas.',
    groups: [
      {
        group: 'Sobre a plataforma',
        items: [
          { q: 'O que é o Pixgo?', a: 'O Pixgo é um conjunto de plataformas digitais de produtividade (compressão, conversão, edição de PDF, geração de documentos, currículos, assinatura eletrónica, remoção de fundo, gravação de ecrã e códigos QR, entre outras) reunidas sob uma única conta e um único plano de subscrição.' },
          { q: 'Preciso de instalar alguma coisa para utilizar as ferramentas?', a: 'Não. Todas as ferramentas funcionam diretamente no browser. Para telemóveis, tablets e televisores Android existe ainda uma aplicação nativa opcional, disponível na página de transferências.' },
          { q: 'As ferramentas funcionam em qualquer dispositivo?', a: 'Sim. A plataforma foi criada para funcionar em computadores, telemóveis e tablets, através do browser, e conta com uma aplicação Android dedicada para telemóvel e Android TV.' },
        ],
      },
      {
        group: 'Planos e pagamentos',
        items: [
          { q: 'O Pixgo é gratuito?', a: 'Sim. Existe um plano gratuito, com acesso às funcionalidades essenciais e apresentação de publicidade. Os planos pagos removem a publicidade e desbloqueiam a totalidade das funcionalidades de todas as ferramentas.' },
          { q: 'Como cancelo a minha subscrição?', a: 'O cancelamento pode ser feito a qualquer momento na área de conta, na secção de planos. O acesso premium mantém se ativo até ao final do período já pago.' },
          { q: 'O que acontece se uma ferramenta falhar durante o meu plano pago?', a: 'Deve reportar a situação ao suporte. A equipa procede à correção da anomalia ou, quando isso não for possível num prazo razoável, à compensação proporcional do período afetado, conforme descrito nos Termos e Condições.' },
        ],
      },
      {
        group: 'Aplicação Android',
        items: [
          { q: 'É seguro instalar a aplicação fora da Play Store?', a: 'O ficheiro é disponibilizado diretamente pelos servidores oficiais do Pixgo, sem intermediários. O aviso do Android durante a instalação é padrão para qualquer aplicação instalada fora de uma loja de aplicações e não constitui um alerta sobre o ficheiro em si.' },
          { q: 'Existe aplicação para iPhone e iPad?', a: 'O Pixgo está disponível em iOS como aplicação progressiva instalável diretamente a partir do Safari, com uma experiência equivalente a uma aplicação nativa.' },
          { q: 'Como atualizo a aplicação Android depois de instalada?', a: 'Basta voltar à página de transferências e instalar a versão mais recente sempre que disponível. O instalador substitui a versão anterior sem afetar os dados da conta, que ficam guardados na nuvem.' },
        ],
      },
      {
        group: 'Segurança e dados',
        items: [
          { q: 'Os meus ficheiros ficam guardados nos servidores do Pixgo?', a: 'Não de forma permanente. Os ficheiros são utilizados apenas para concluir a operação solicitada e eliminados dos servidores de processamento assim que o resultado é entregue, salvo um curto período técnico de retenção. Mais detalhes na página de Segurança.' },
          { q: 'O Pixgo partilha os meus dados com terceiros?', a: 'Não. Os dados são utilizados apenas para o funcionamento da plataforma, gestão da conta e da subscrição, e não são vendidos nem cedidos para publicidade direcionada de terceiros.' },
        ],
      },
    ],
  },
  en: {
    title: 'Frequently asked questions',
    subtitle: 'Answers to the most common questions about the platform, plans, and tools.',
    groups: [
      {
        group: 'About the platform',
        items: [
          { q: 'What is Pixgo?', a: 'Pixgo is a suite of digital productivity platforms (compression, conversion, PDF editing, document generation, resumes, electronic signing, background removal, screen recording, and QR codes, among others) brought together under a single account and a single subscription plan.' },
          { q: 'Do I need to install anything to use the tools?', a: 'No. All tools work directly in the browser. For Android phones, tablets, and TVs, an optional native application is also available on the downloads page.' },
          { q: 'Do the tools work on any device?', a: 'Yes. The platform was built to work on computers, phones, and tablets through the browser, and also has a dedicated Android application for phones and Android TV.' },
        ],
      },
      {
        group: 'Plans and payments',
        items: [
          { q: 'Is Pixgo free?', a: 'Yes. There is a free plan, with access to the essential features and advertising displayed. Paid plans remove advertising and unlock the full set of features across every tool.' },
          { q: 'How do I cancel my subscription?', a: 'Cancellation can be done at any time from the account area, in the plans section. Premium access remains active until the end of the period already paid for.' },
          { q: 'What happens if a tool fails during my paid plan?', a: 'You should report the situation to support. The team will correct the issue or, when that is not possible within a reasonable time frame, provide proportional compensation for the affected period, as described in the Terms and Conditions.' },
        ],
      },
      {
        group: 'Android application',
        items: [
          { q: 'Is it safe to install the app outside the Play Store?', a: 'The file is provided directly from Pixgo\'s official servers, with no intermediaries. The Android warning shown during installation is standard for any app installed outside an app store and is not a warning about the file itself.' },
          { q: 'Is there an app for iPhone and iPad?', a: 'Pixgo is available on iOS as a progressive web app, installable directly from Safari, with an experience equivalent to a native app.' },
          { q: 'How do I update the Android app once installed?', a: 'Simply return to the downloads page and install the latest version whenever available. The installer replaces the previous version without affecting account data, which is stored in the cloud.' },
        ],
      },
      {
        group: 'Security and data',
        items: [
          { q: 'Are my files kept on Pixgo\'s servers?', a: 'Not on a permanent basis. Files are used only to complete the requested operation and are deleted from the processing servers as soon as the result is delivered, except for a short technical retention period. More details on the Security page.' },
          { q: 'Does Pixgo share my data with third parties?', a: 'No. Data is used only to operate the platform and manage the account and subscription, and is not sold or transferred for third party targeted advertising.' },
        ],
      },
    ],
  },
  es: {
    title: 'Preguntas frecuentes',
    subtitle: 'Respuestas a las dudas más comunes sobre la plataforma, los planes y las herramientas.',
    groups: [
      {
        group: 'Sobre la plataforma',
        items: [
          { q: '¿Qué es Pixgo?', a: 'Pixgo es un conjunto de plataformas digitales de productividad (compresión, conversión, edición de PDF, generación de documentos, currículums, firma electrónica, eliminación de fondo, grabación de pantalla y códigos QR, entre otras) reunidas bajo una única cuenta y un único plan de suscripción.' },
          { q: '¿Necesito instalar algo para usar las herramientas?', a: 'No. Todas las herramientas funcionan directamente en el navegador. Para teléfonos, tabletas y televisores Android existe además una aplicación nativa opcional, disponible en la página de descargas.' },
          { q: '¿Las herramientas funcionan en cualquier dispositivo?', a: 'Sí. La plataforma se creó para funcionar en ordenadores, teléfonos y tabletas a través del navegador, y cuenta además con una aplicación Android dedicada para teléfono y Android TV.' },
        ],
      },
      {
        group: 'Planes y pagos',
        items: [
          { q: '¿Pixgo es gratuito?', a: 'Sí. Existe un plan gratuito, con acceso a las funciones esenciales y publicidad. Los planes de pago eliminan la publicidad y desbloquean la totalidad de las funciones de todas las herramientas.' },
          { q: '¿Cómo cancelo mi suscripción?', a: 'La cancelación puede realizarse en cualquier momento desde el área de cuenta, en la sección de planes. El acceso premium permanece activo hasta el final del período ya pagado.' },
          { q: '¿Qué ocurre si una herramienta falla durante mi plan de pago?', a: 'Debe reportar la situación al soporte. El equipo corregirá la anomalía o, cuando no sea posible en un plazo razonable, compensará proporcionalmente el período afectado, según lo descrito en los Términos y Condiciones.' },
        ],
      },
      {
        group: 'Aplicación Android',
        items: [
          { q: '¿Es seguro instalar la aplicación fuera de la Play Store?', a: 'El archivo se proporciona directamente desde los servidores oficiales de Pixgo, sin intermediarios. El aviso de Android durante la instalación es estándar para cualquier aplicación instalada fuera de una tienda de aplicaciones y no constituye una alerta sobre el archivo en sí.' },
          { q: '¿Existe aplicación para iPhone y iPad?', a: 'Pixgo está disponible en iOS como aplicación progresiva instalable directamente desde Safari, con una experiencia equivalente a una aplicación nativa.' },
          { q: '¿Cómo actualizo la aplicación Android una vez instalada?', a: 'Basta con volver a la página de descargas e instalar la versión más reciente cuando esté disponible. El instalador sustituye la versión anterior sin afectar los datos de la cuenta, que se guardan en la nube.' },
        ],
      },
      {
        group: 'Seguridad y datos',
        items: [
          { q: '¿Mis archivos se guardan en los servidores de Pixgo?', a: 'No de forma permanente. Los archivos se utilizan solo para completar la operación solicitada y se eliminan de los servidores de procesamiento en cuanto se entrega el resultado, salvo un breve período técnico de retención. Más detalles en la página de Seguridad.' },
          { q: '¿Pixgo comparte mis datos con terceros?', a: 'No. Los datos se utilizan únicamente para el funcionamiento de la plataforma y la gestión de la cuenta y la suscripción, y no se venden ni se ceden con fines de publicidad dirigida de terceros.' },
        ],
      },
    ],
  },
};

export default function FaqPage() {
  const lang = useLegalLang();
  const content = CONTENT[lang];
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div style={{ maxWidth: 760 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <HelpOutlineIcon style={{ fontSize: 26, color: 'var(--color-primary)' }} />
            {content.title}
          </h1>
          <p className="page-subtitle">{content.subtitle}</p>
        </div>
      </div>

      {content.groups.map((group, gi) => (
        <div key={gi} style={{ marginBottom: 26 }}>
          <div className="tool-section-label">{group.group}</div>
          <div className="card" style={{ overflow: 'visible' }}>
            {group.items.map((item, ii) => {
              const key = `${gi}-${ii}`;
              const isOpen = open === key;
              return (
                <div key={key} style={{ borderBottom: ii === group.items.length - 1 ? 'none' : '1px solid var(--color-border)' }}>
                  <div
                    onClick={() => setOpen(isOpen ? null : key)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '15px 17px', cursor: 'pointer' }}
                  >
                    <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text-light)' }}>{item.q}</span>
                    <ExpandMoreIcon style={{ fontSize: 20, color: 'var(--color-text-muted)', flexShrink: 0, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                  </div>
                  {isOpen && (
                    <p style={{ padding: '0 17px 17px', fontSize: '0.85rem', lineHeight: 1.7, color: 'var(--color-text-muted)', margin: 0 }}>
                      {item.a}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
