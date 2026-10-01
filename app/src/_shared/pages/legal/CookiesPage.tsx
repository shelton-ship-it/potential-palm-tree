'use client';
import React from 'react';
import CookieOutlinedIcon from '@mui/icons-material/CookieOutlined';
import LegalLayout, { LegalContent } from '../../components/legal/LegalLayout';
import { useLegalLang, LegalLang } from '../../lib/legalLang';

const CONTENT: Record<LegalLang, LegalContent> = {
  pt: {
    title: 'Política de cookies',
    kicker: 'Privacidade',
    subtitle: 'Que cookies e tecnologias semelhantes são utilizados na plataforma Pixgo, e para quê.',
    updated: 'Atualizado em agosto de 2026',
    sections: [
      {
        heading: 'Âmbito da política',
        paragraphs: [
          'Política relativa à utilização de cookies e tecnologias semelhantes na plataforma digital Pixgo.',
        ],
      },
      {
        heading: 'Âmbito da política',
        paragraphs: [
          'A presente Política de Cookies explica de que forma a Pixgo utiliza cookies e tecnologias semelhantes no funcionamento da sua plataforma digital.',
          'Esta política aplica-se aos acessos à Pixgo através de navegadores, aplicações web, aplicações progressivas e outros ambientes digitais em que sejam utilizadas tecnologias de armazenamento ou identificação semelhantes.',
          'A presente política deve ser lida conjuntamente com a Política de Privacidade, os Termos e Condições e os demais documentos legais aplicáveis à utilização da Plataforma.',
        ],
      },
      {
        heading: 'O que são cookies',
        paragraphs: [
          'Cookies são pequenos ficheiros ou informações armazenadas no dispositivo utilizado para aceder a um serviço digital. Permitem reconhecer uma sessão, preservar determinadas configurações, melhorar a navegação e assegurar o funcionamento de funcionalidades específicas.',
          'Além dos cookies tradicionais, a Pixgo poderá utilizar tecnologias semelhantes, incluindo armazenamento local do navegador, armazenamento de sessão, identificadores técnicos e mecanismos equivalentes destinados a preservar informações necessárias ao funcionamento da Plataforma.',
          'Estas tecnologias podem ser utilizadas durante uma sessão específica ou permanecer armazenadas durante determinado período, conforme a sua finalidade.',
        ],
      },
      {
        heading: 'Cookies estritamente necessários',
        paragraphs: [
          'Alguns cookies e tecnologias semelhantes são necessários para o funcionamento da Pixgo e não podem ser desativados através das opções normais de configuração da Plataforma.',
          'Podem ser utilizados, entre outras finalidades, para:',
        ],
        list: [
          'manter a sessão de utilizador autenticada;',
          'permitir a navegação entre diferentes áreas da Plataforma;',
          'preservar informações necessárias ao funcionamento dos serviços;',
          'aplicar mecanismos de segurança;',
          'prevenir utilizações abusivas;',
          'detetar atividades anómalas;',
          'proteger contas e sessões contra acessos não autorizados;',
          'garantir a estabilidade e integridade da Plataforma.',
        ],
        note: 'A desativação ou bloqueio destas tecnologias poderá impedir o funcionamento correto de determinadas funcionalidades, incluindo autenticação, manutenção da sessão e acesso a áreas protegidas.',
      },
      {
        heading: 'Cookies de preferências',
        paragraphs: [
          'A Pixgo poderá utilizar cookies e tecnologias semelhantes para guardar determinadas preferências escolhidas pelo utilizador.',
          'Estas tecnologias podem permitir, por exemplo, preservar:',
        ],
        list: [
          'idioma selecionado;',
          'preferências de apresentação;',
          'determinadas configurações da interface;',
          'preferências de navegação;',
          'estado de determinados elementos da Plataforma.',
        ],
        note: 'A finalidade é evitar que o utilizador tenha de configurar repetidamente as mesmas opções durante diferentes acessos. Os cookies de preferências não são necessariamente essenciais ao funcionamento técnico da Plataforma, mas podem melhorar a experiência de utilização.',
      },
      {
        heading: 'Cookies de desempenho e funcionamento',
        paragraphs: [
          'A Pixgo poderá utilizar tecnologias destinadas a compreender o desempenho técnico da Plataforma e a identificar problemas que possam afetar a experiência dos utilizadores.',
          'Essas tecnologias podem permitir analisar informações técnicas relacionadas com carregamento de páginas, funcionamento de funcionalidades, erros, desempenho de determinadas operações e utilização geral da infraestrutura.',
          'As informações obtidas através destes mecanismos destinam-se a apoiar a manutenção, estabilidade, segurança e melhoria dos serviços.',
          'Sempre que aplicável, a utilização de tecnologias que não sejam estritamente necessárias estará sujeita aos mecanismos de consentimento exigidos pela legislação aplicável.',
        ],
      },
      {
        heading: 'Cookies relacionados com publicidade',
        paragraphs: [
          'A modalidade gratuita da Pixgo poderá apresentar publicidade.',
          'Quando a publicidade seja disponibilizada através de parceiros externos, esses parceiros poderão utilizar cookies, identificadores ou tecnologias semelhantes para determinadas finalidades relacionadas com a disponibilização, medição, análise ou gestão da publicidade.',
          'Essas tecnologias poderão ser administradas diretamente pelos respetivos parceiros e não necessariamente pela Pixgo.',
          'A utilização dessas tecnologias por terceiros está sujeita às políticas e condições dos respetivos fornecedores, bem como às opções de consentimento disponibilizadas quando exigidas.',
          'A Pixgo não controla integralmente as tecnologias utilizadas por terceiros fora da sua própria infraestrutura.',
        ],
      },
      {
        heading: 'Utilizadores de planos pagos',
        paragraphs: [
          'Quando determinado plano pago incluir a remoção de publicidade, a apresentação de publicidade através da Pixgo será desativada de acordo com as condições desse plano.',
          'Consequentemente, as tecnologias utilizadas exclusivamente para disponibilizar publicidade através da Plataforma poderão não ser utilizadas durante o período em que essa funcionalidade estiver desativada.',
          'A existência ou utilização de cookies estritamente necessários ao funcionamento, segurança, autenticação e manutenção da Plataforma não depende da apresentação de publicidade.',
        ],
      },
      {
        heading: 'Tecnologias de sessão e autenticação',
        paragraphs: [
          'A Pixgo poderá utilizar mecanismos de armazenamento associados à sessão do utilizador para permitir a autenticação e manutenção segura do acesso à conta.',
          'Esses mecanismos podem conter identificadores técnicos necessários para reconhecer uma sessão válida e aplicar medidas de segurança.',
          'As informações de autenticação não devem ser interpretadas como armazenamento da palavra-passe do utilizador em formato acessível através de cookies.',
          'A utilização desses mecanismos é necessária para disponibilizar determinadas funcionalidades da conta.',
        ],
      },
      {
        heading: 'Cookies de segurança',
        paragraphs: [
          'Cookies e tecnologias semelhantes podem ser utilizados para reforçar a segurança da Plataforma.',
          'Entre as respetivas finalidades podem incluir-se a identificação de sessões legítimas, prevenção de utilização automatizada abusiva, deteção de comportamentos anómalos, proteção contra determinados ataques e aplicação de mecanismos de controlo de acesso.',
          'Essas tecnologias poderão ser renovadas, alteradas ou eliminadas automaticamente de acordo com os requisitos de segurança da Plataforma.',
        ],
      },
      {
        heading: 'Armazenamento local e tecnologias semelhantes',
        paragraphs: [
          'Determinadas funcionalidades da Pixgo poderão utilizar mecanismos de armazenamento disponibilizados pelo navegador ou dispositivo, incluindo armazenamento local e armazenamento temporário de sessão.',
          'Esses mecanismos podem ser utilizados para conservar informações necessárias ao funcionamento da interface, preferências do utilizador ou dados técnicos associados à utilização dos serviços.',
          'O armazenamento local não constitui, por si só, uma forma de transferência de propriedade sobre os dados armazenados pelo utilizador.',
        ],
      },
      {
        heading: 'Cookies de terceiros',
        paragraphs: [
          'Determinadas funcionalidades da Plataforma poderão depender de serviços fornecidos por terceiros.',
          'Esses terceiros poderão utilizar os seus próprios cookies ou tecnologias semelhantes de acordo com as respetivas políticas.',
          'A Pixgo procura utilizar apenas serviços compatíveis com os requisitos técnicos, operacionais e legais aplicáveis à Plataforma, mas não controla integralmente as práticas de cookies de entidades externas.',
          'O utilizador deverá consultar as políticas dos respetivos terceiros quando pretenda obter informações específicas sobre as tecnologias utilizadas por esses serviços.',
        ],
      },
      {
        heading: 'Base legal',
        paragraphs: [
          'A utilização de cookies e tecnologias semelhantes pela Pixgo será realizada de acordo com a legislação aplicável.',
          'As tecnologias estritamente necessárias para disponibilizar um serviço solicitado pelo utilizador poderão ser utilizadas sem consentimento quando tal seja permitido pela legislação aplicável.',
          'Para tecnologias que dependam de consentimento, a Pixgo disponibilizará mecanismos adequados para permitir ao utilizador aceitar, recusar ou gerir essas tecnologias, quando legalmente exigido.',
          'O consentimento poderá ser retirado ou alterado através dos mecanismos disponibilizados pela Plataforma, sem prejuízo da utilização das tecnologias estritamente necessárias ao funcionamento do serviço.',
        ],
      },
      {
        heading: 'Gestão de cookies pelo navegador',
        paragraphs: [
          'A maioria dos navegadores permite ao utilizador visualizar, bloquear, eliminar ou restringir cookies através das respetivas definições de privacidade e segurança.',
          'O utilizador poderá configurar o navegador para rejeitar determinados cookies ou alertá-lo antes de permitir o seu armazenamento.',
          'A gestão de cookies diretamente no navegador poderá afetar a experiência de utilização da Pixgo.',
          'O bloqueio de cookies essenciais ou de determinadas tecnologias necessárias à autenticação poderá impedir o funcionamento de funcionalidades da conta e de áreas protegidas da Plataforma.',
        ],
      },
      {
        heading: 'Eliminação de cookies',
        paragraphs: [
          'O utilizador pode eliminar cookies armazenados no seu dispositivo através das definições do navegador utilizado.',
          'A eliminação de cookies poderá resultar na perda de determinadas preferências ou na necessidade de iniciar novamente uma sessão.',
          'Após a eliminação, determinados cookies poderão ser novamente criados quando o utilizador voltar a utilizar funcionalidades que dependam deles.',
        ],
      },
      {
        heading: 'Duração dos cookies',
        paragraphs: [
          'Os cookies podem apresentar diferentes períodos de validade.',
          'Alguns existem apenas durante a sessão de navegação e são eliminados quando esta termina. Outros poderão permanecer no dispositivo durante determinado período, de acordo com a finalidade para a qual foram configurados.',
          'A duração concreta poderá variar em função da categoria do cookie, da funcionalidade correspondente, das configurações técnicas e das exigências legais aplicáveis.',
        ],
      },
      {
        heading: 'Alterações aos cookies utilizados',
        paragraphs: [
          'A Pixgo poderá alterar as tecnologias utilizadas na Plataforma em função da evolução dos serviços, requisitos de segurança, alterações técnicas, introdução de novas funcionalidades ou integração de novos fornecedores.',
          'A alteração de tecnologias poderá implicar a introdução, substituição ou remoção de determinados cookies.',
          'Quando uma alteração relevante exigir nova informação ou consentimento nos termos da legislação aplicável, serão adotados os mecanismos adequados.',
        ],
      },
      {
        heading: 'Privacidade',
        paragraphs: [
          'Os cookies poderão estar associados a informações técnicas ou, em determinadas circunstâncias, a informações relacionadas com um utilizador ou dispositivo.',
          'O tratamento de dados pessoais eventualmente associado à utilização de cookies é regulado pela Política de Privacidade da Pixgo.',
          'A presente Política de Cookies deve, por isso, ser interpretada conjuntamente com a Política de Privacidade, que estabelece as regras aplicáveis ao tratamento de dados pessoais.',
        ],
      },
      {
        heading: 'Direitos do utilizador',
        paragraphs: [
          'O utilizador poderá exercer os direitos que lhe sejam conferidos pela legislação aplicável relativamente ao tratamento dos seus dados pessoais e à utilização de tecnologias de rastreamento ou armazenamento.',
          'Dependendo da legislação aplicável, esses direitos poderão incluir o direito de acesso, retificação, eliminação, oposição, limitação do tratamento, retirada do consentimento e outros direitos legalmente reconhecidos.',
          'Os pedidos relacionados com privacidade poderão ser apresentados através dos canais oficiais de contacto disponibilizados pela Pixgo.',
        ],
      },
      {
        heading: 'Atualização da política',
        paragraphs: [
          'A Pixgo poderá atualizar esta Política de Cookies sempre que necessário para refletir alterações na Plataforma, nas tecnologias utilizadas, nos fornecedores, nos requisitos legais ou nas práticas de tratamento de informações.',
          'A versão vigente será disponibilizada na Plataforma e identificada pela respetiva data de atualização.',
          'Recomenda-se ao utilizador a consulta periódica desta página para conhecer eventuais alterações relevantes.',
        ],
      },
      {
        heading: 'Contacto',
        paragraphs: [
          'Para questões relacionadas com cookies, tecnologias semelhantes ou privacidade, o utilizador poderá contactar a Pixgo através dos canais oficiais disponibilizados na Plataforma.',
        ],
        contactEmail: 'support@pixgo.qzz.io',
      },
      {
        heading: 'Versão da política',
        paragraphs: [
          'A presente Política de Cookies corresponde à versão publicada pela Pixgo em agosto de 2026.',
          'A data indicada no início desta página identifica a versão atualmente vigente.',
        ],
      },
    ],
  },
  en: {
    title: 'Cookie policy',
    kicker: 'Privacy',
    subtitle: 'Which cookies and similar technologies are used on the Pixgo platform, and for what purpose.',
    updated: 'Updated August 2026',
    sections: [
      {
        heading: 'Scope of this policy',
        paragraphs: [
          'Policy on the use of cookies and similar technologies on the Pixgo digital platform.',
        ],
      },
      {
        heading: '1. Scope of this policy',
        paragraphs: [
          'This Cookie Policy explains how Pixgo uses cookies and similar technologies in the operation of its digital platform.',
          'This policy applies to accessing Pixgo through browsers, web applications, progressive applications, and other digital environments where similar storage or identification technologies are used.',
          'This policy should be read together with the Privacy Policy, the Terms and Conditions, and the other legal documents applicable to using the Platform.',
        ],
      },
      {
        heading: '2. What cookies are',
        paragraphs: [
          'Cookies are small files or pieces of information stored on the device used to access a digital service. They make it possible to recognise a session, preserve certain settings, improve navigation, and ensure specific features work correctly.',
          'In addition to traditional cookies, Pixgo may use similar technologies, including browser local storage, session storage, technical identifiers, and equivalent mechanisms intended to preserve information necessary for the Platform to function.',
          'These technologies may be used during a specific session or remain stored for a certain period, depending on their purpose.',
        ],
      },
      {
        heading: '3. Strictly necessary cookies',
        paragraphs: [
          'Some cookies and similar technologies are necessary for Pixgo to function and cannot be disabled through the Platform\'s normal configuration options.',
          'They may be used, among other purposes, to:',
        ],
        list: [
          'keep the user session authenticated;',
          'allow navigation between different areas of the Platform;',
          'preserve information necessary for the services to function;',
          'apply security mechanisms;',
          'prevent abusive use;',
          'detect anomalous activity;',
          'protect accounts and sessions against unauthorised access;',
          'ensure the stability and integrity of the Platform.',
        ],
        note: 'Disabling or blocking these technologies may prevent certain features from working correctly, including authentication, session maintenance, and access to protected areas.',
      },
      {
        heading: '4. Preference cookies',
        paragraphs: [
          'Pixgo may use cookies and similar technologies to save certain preferences chosen by the user.',
          'These technologies may make it possible, for example, to preserve:',
        ],
        list: [
          'selected language;',
          'display preferences;',
          'certain interface settings;',
          'navigation preferences;',
          'the state of certain Platform elements.',
        ],
        note: 'The purpose is to avoid the user having to repeatedly configure the same options across different visits. Preference cookies are not necessarily essential to the Platform\'s technical operation, but they can improve the user experience.',
      },
      {
        heading: '5. Performance and functioning cookies',
        paragraphs: [
          'Pixgo may use technologies intended to understand the Platform\'s technical performance and identify problems that could affect the user experience.',
          'These technologies may make it possible to analyse technical information related to page loading, feature operation, errors, performance of certain operations, and general infrastructure use.',
          'The information obtained through these mechanisms is intended to support the maintenance, stability, security, and improvement of the services.',
          'Whenever applicable, the use of technologies that are not strictly necessary will be subject to the consent mechanisms required by applicable law.',
        ],
      },
      {
        heading: '6. Advertising-related cookies',
        paragraphs: [
          'Pixgo\'s free tier may display advertising.',
          'Where advertising is provided through external partners, those partners may use cookies, identifiers, or similar technologies for purposes related to serving, measuring, analysing, or managing advertising.',
          'These technologies may be managed directly by the relevant partners and not necessarily by Pixgo.',
          'The use of these technologies by third parties is subject to the policies and conditions of their respective providers, as well as the consent options made available where required.',
          'Pixgo does not fully control technologies used by third parties outside its own infrastructure.',
        ],
      },
      {
        heading: '7. Paid-plan users',
        paragraphs: [
          'Where a given paid plan includes ad removal, the display of advertising through Pixgo will be disabled in accordance with that plan\'s conditions.',
          'Consequently, technologies used exclusively to serve advertising through the Platform may not be used during the period in which that feature is disabled.',
          'The existence or use of cookies strictly necessary for the Platform\'s operation, security, authentication, and maintenance does not depend on advertising being displayed.',
        ],
      },
      {
        heading: '8. Session and authentication technologies',
        paragraphs: [
          'Pixgo may use storage mechanisms associated with the user\'s session to enable authentication and secure maintenance of account access.',
          'These mechanisms may contain technical identifiers necessary to recognise a valid session and apply security measures.',
          'Authentication information should not be interpreted as storing the user\'s password in a format accessible through cookies.',
          'Using these mechanisms is necessary to provide certain account features.',
        ],
      },
      {
        heading: '9. Security cookies',
        paragraphs: [
          'Cookies and similar technologies may be used to strengthen the Platform\'s security.',
          'Their purposes may include identifying legitimate sessions, preventing abusive automated use, detecting anomalous behaviour, protecting against certain attacks, and applying access-control mechanisms.',
          'These technologies may be renewed, changed, or deleted automatically according to the Platform\'s security requirements.',
        ],
      },
      {
        heading: '10. Local storage and similar technologies',
        paragraphs: [
          'Certain Pixgo features may use storage mechanisms provided by the browser or device, including local storage and temporary session storage.',
          'These mechanisms may be used to keep information necessary for the interface to function, user preferences, or technical data associated with using the services.',
          'Local storage does not, by itself, constitute a transfer of ownership over the data stored by the user.',
        ],
      },
      {
        heading: '11. Third-party cookies',
        paragraphs: [
          'Certain Platform features may depend on services provided by third parties.',
          'These third parties may use their own cookies or similar technologies in accordance with their respective policies.',
          'Pixgo seeks to use only services compatible with the technical, operational, and legal requirements applicable to the Platform, but does not fully control the cookie practices of external entities.',
          'The user should consult the relevant third parties\' policies when seeking specific information about the technologies used by those services.',
        ],
      },
      {
        heading: '12. Legal basis',
        paragraphs: [
          'Pixgo\'s use of cookies and similar technologies will be carried out in accordance with applicable law.',
          'Technologies strictly necessary to provide a service requested by the user may be used without consent where this is permitted by applicable law.',
          'For technologies that depend on consent, Pixgo will provide suitable mechanisms allowing the user to accept, refuse, or manage those technologies, where legally required.',
          'Consent may be withdrawn or changed through the mechanisms provided by the Platform, without prejudice to the use of technologies strictly necessary for the service to function.',
        ],
      },
      {
        heading: '13. Managing cookies through the browser',
        paragraphs: [
          'Most browsers allow the user to view, block, delete, or restrict cookies through their respective privacy and security settings.',
          'The user may configure the browser to reject certain cookies or to alert them before allowing storage.',
          'Managing cookies directly in the browser may affect the Pixgo user experience.',
          'Blocking essential cookies or certain technologies necessary for authentication may prevent account features and protected areas of the Platform from working.',
        ],
      },
      {
        heading: '14. Deleting cookies',
        paragraphs: [
          'The user can delete cookies stored on their device through the settings of the browser used.',
          'Deleting cookies may result in the loss of certain preferences or the need to start a session again.',
          'After deletion, certain cookies may be recreated when the user resumes using features that depend on them.',
        ],
      },
      {
        heading: '15. Cookie duration',
        paragraphs: [
          'Cookies may have different validity periods.',
          'Some exist only during the browsing session and are deleted when it ends. Others may remain on the device for a certain period, according to the purpose for which they were configured.',
          'The specific duration may vary depending on the cookie category, the corresponding feature, technical settings, and applicable legal requirements.',
        ],
      },
      {
        heading: '16. Changes to the cookies used',
        paragraphs: [
          'Pixgo may change the technologies used on the Platform as services evolve, security requirements change, technical changes occur, new features are introduced, or new providers are integrated.',
          'Changing technologies may involve introducing, replacing, or removing certain cookies.',
          'Where a significant change requires new notice or consent under applicable law, suitable mechanisms will be adopted.',
        ],
      },
      {
        heading: '17. Privacy',
        paragraphs: [
          'Cookies may be associated with technical information or, in certain circumstances, with information relating to a user or device.',
          'The processing of personal data that may be associated with the use of cookies is governed by Pixgo\'s Privacy Policy.',
          'This Cookie Policy should therefore be read together with the Privacy Policy, which sets out the rules applicable to the processing of personal data.',
        ],
      },
      {
        heading: '18. User rights',
        paragraphs: [
          'The user may exercise the rights granted to them under applicable law regarding the processing of their personal data and the use of tracking or storage technologies.',
          'Depending on applicable law, these rights may include the right of access, rectification, erasure, objection, restriction of processing, withdrawal of consent, and other legally recognised rights.',
          'Requests related to privacy may be submitted through the official contact channels provided by Pixgo.',
        ],
      },
      {
        heading: '19. Updates to this policy',
        paragraphs: [
          'Pixgo may update this Cookie Policy whenever necessary to reflect changes to the Platform, the technologies used, providers, legal requirements, or information-processing practices.',
          'The current version will be made available on the Platform and identified by its update date.',
          'The user is advised to periodically review this page to learn of any relevant changes.',
        ],
      },
      {
        heading: '20. Contact',
        paragraphs: [
          'For questions related to cookies, similar technologies, or privacy, the user may contact Pixgo through the official channels provided on the Platform.',
        ],
        contactEmail: 'support@pixgo.qzz.io',
      },
      {
        heading: '21. Version of this policy',
        paragraphs: [
          'This Cookie Policy corresponds to the version published by Pixgo in August 2026.',
          'The date indicated at the top of this page identifies the currently effective version.',
        ],
      },
    ],
  },
  es: {
    title: 'Política de cookies',
    kicker: 'Privacidad',
    subtitle: 'Qué cookies y tecnologías similares se utilizan en la plataforma Pixgo, y con qué fin.',
    updated: 'Actualizado en agosto de 2026',
    sections: [
      {
        heading: 'Ámbito de la política',
        paragraphs: [
          'Política relativa al uso de cookies y tecnologías similares en la plataforma digital Pixgo.',
        ],
      },
      {
        heading: '1. Ámbito de la política',
        paragraphs: [
          'La presente Política de Cookies explica de qué manera Pixgo utiliza cookies y tecnologías similares en el funcionamiento de su plataforma digital.',
          'Esta política se aplica a los accesos a Pixgo a través de navegadores, aplicaciones web, aplicaciones progresivas y otros entornos digitales en los que se utilicen tecnologías de almacenamiento o identificación similares.',
          'La presente política debe leerse junto con la Política de Privacidad, los Términos y Condiciones y los demás documentos legales aplicables al uso de la Plataforma.',
        ],
      },
      {
        heading: '2. Qué son las cookies',
        paragraphs: [
          'Las cookies son pequeños archivos o información almacenados en el dispositivo utilizado para acceder a un servicio digital. Permiten reconocer una sesión, conservar determinadas configuraciones, mejorar la navegación y garantizar el funcionamiento de funcionalidades específicas.',
          'Además de las cookies tradicionales, Pixgo podrá utilizar tecnologías similares, incluyendo almacenamiento local del navegador, almacenamiento de sesión, identificadores técnicos y mecanismos equivalentes destinados a conservar información necesaria para el funcionamiento de la Plataforma.',
          'Estas tecnologías pueden utilizarse durante una sesión específica o permanecer almacenadas durante un período determinado, según su finalidad.',
        ],
      },
      {
        heading: '3. Cookies estrictamente necesarias',
        paragraphs: [
          'Algunas cookies y tecnologías similares son necesarias para el funcionamiento de Pixgo y no pueden desactivarse a través de las opciones normales de configuración de la Plataforma.',
          'Pueden utilizarse, entre otras finalidades, para:',
        ],
        list: [
          'mantener la sesión del usuario autenticada;',
          'permitir la navegación entre diferentes áreas de la Plataforma;',
          'conservar información necesaria para el funcionamiento de los servicios;',
          'aplicar mecanismos de seguridad;',
          'prevenir usos abusivos;',
          'detectar actividades anómalas;',
          'proteger cuentas y sesiones contra accesos no autorizados;',
          'garantizar la estabilidad e integridad de la Plataforma.',
        ],
        note: 'La desactivación o el bloqueo de estas tecnologías podrá impedir el funcionamiento correcto de determinadas funcionalidades, incluyendo la autenticación, el mantenimiento de la sesión y el acceso a áreas protegidas.',
      },
      {
        heading: '4. Cookies de preferencias',
        paragraphs: [
          'Pixgo podrá utilizar cookies y tecnologías similares para guardar determinadas preferencias elegidas por el usuario.',
          'Estas tecnologías pueden permitir, por ejemplo, conservar:',
        ],
        list: [
          'idioma seleccionado;',
          'preferencias de presentación;',
          'determinadas configuraciones de la interfaz;',
          'preferencias de navegación;',
          'el estado de determinados elementos de la Plataforma.',
        ],
        note: 'La finalidad es evitar que el usuario tenga que configurar repetidamente las mismas opciones en diferentes accesos. Las cookies de preferencias no son necesariamente esenciales para el funcionamiento técnico de la Plataforma, pero pueden mejorar la experiencia de uso.',
      },
      {
        heading: '5. Cookies de rendimiento y funcionamiento',
        paragraphs: [
          'Pixgo podrá utilizar tecnologías destinadas a comprender el rendimiento técnico de la Plataforma y a identificar problemas que puedan afectar la experiencia de los usuarios.',
          'Estas tecnologías pueden permitir analizar información técnica relacionada con la carga de páginas, el funcionamiento de las funcionalidades, errores, el rendimiento de determinadas operaciones y el uso general de la infraestructura.',
          'La información obtenida a través de estos mecanismos tiene como finalidad apoyar el mantenimiento, la estabilidad, la seguridad y la mejora de los servicios.',
          'Siempre que corresponda, el uso de tecnologías que no sean estrictamente necesarias estará sujeto a los mecanismos de consentimiento exigidos por la legislación aplicable.',
        ],
      },
      {
        heading: '6. Cookies relacionadas con la publicidad',
        paragraphs: [
          'La modalidad gratuita de Pixgo podrá presentar publicidad.',
          'Cuando la publicidad se ofrezca a través de socios externos, estos podrán utilizar cookies, identificadores o tecnologías similares para determinadas finalidades relacionadas con la presentación, medición, análisis o gestión de la publicidad.',
          'Estas tecnologías podrán ser administradas directamente por los respectivos socios y no necesariamente por Pixgo.',
          'El uso de estas tecnologías por parte de terceros está sujeto a las políticas y condiciones de sus respectivos proveedores, así como a las opciones de consentimiento ofrecidas cuando sean exigidas.',
          'Pixgo no controla íntegramente las tecnologías utilizadas por terceros fuera de su propia infraestructura.',
        ],
      },
      {
        heading: '7. Usuarios de planes de pago',
        paragraphs: [
          'Cuando un determinado plan de pago incluya la eliminación de publicidad, la presentación de publicidad a través de Pixgo se desactivará de acuerdo con las condiciones de ese plan.',
          'En consecuencia, las tecnologías utilizadas exclusivamente para presentar publicidad a través de la Plataforma podrán no utilizarse durante el período en que esa funcionalidad esté desactivada.',
          'La existencia o el uso de cookies estrictamente necesarias para el funcionamiento, la seguridad, la autenticación y el mantenimiento de la Plataforma no depende de la presentación de publicidad.',
        ],
      },
      {
        heading: '8. Tecnologías de sesión y autenticación',
        paragraphs: [
          'Pixgo podrá utilizar mecanismos de almacenamiento asociados a la sesión del usuario para permitir la autenticación y el mantenimiento seguro del acceso a la cuenta.',
          'Estos mecanismos pueden contener identificadores técnicos necesarios para reconocer una sesión válida y aplicar medidas de seguridad.',
          'La información de autenticación no debe interpretarse como el almacenamiento de la contraseña del usuario en un formato accesible a través de cookies.',
          'El uso de estos mecanismos es necesario para ofrecer determinadas funcionalidades de la cuenta.',
        ],
      },
      {
        heading: '9. Cookies de seguridad',
        paragraphs: [
          'Las cookies y tecnologías similares pueden utilizarse para reforzar la seguridad de la Plataforma.',
          'Entre sus finalidades pueden incluirse la identificación de sesiones legítimas, la prevención del uso automatizado abusivo, la detección de comportamientos anómalos, la protección contra determinados ataques y la aplicación de mecanismos de control de acceso.',
          'Estas tecnologías podrán renovarse, modificarse o eliminarse automáticamente de acuerdo con los requisitos de seguridad de la Plataforma.',
        ],
      },
      {
        heading: '10. Almacenamiento local y tecnologías similares',
        paragraphs: [
          'Determinadas funcionalidades de Pixgo podrán utilizar mecanismos de almacenamiento ofrecidos por el navegador o el dispositivo, incluyendo el almacenamiento local y el almacenamiento temporal de sesión.',
          'Estos mecanismos pueden utilizarse para conservar información necesaria para el funcionamiento de la interfaz, las preferencias del usuario o datos técnicos asociados al uso de los servicios.',
          'El almacenamiento local no constituye, por sí solo, una forma de transferencia de propiedad sobre los datos almacenados por el usuario.',
        ],
      },
      {
        heading: '11. Cookies de terceros',
        paragraphs: [
          'Determinadas funcionalidades de la Plataforma podrán depender de servicios prestados por terceros.',
          'Estos terceros podrán utilizar sus propias cookies o tecnologías similares de acuerdo con sus respectivas políticas.',
          'Pixgo procura utilizar únicamente servicios compatibles con los requisitos técnicos, operativos y legales aplicables a la Plataforma, pero no controla íntegramente las prácticas de cookies de entidades externas.',
          'El usuario deberá consultar las políticas de los respectivos terceros cuando desee obtener información específica sobre las tecnologías utilizadas por esos servicios.',
        ],
      },
      {
        heading: '12. Base legal',
        paragraphs: [
          'El uso de cookies y tecnologías similares por parte de Pixgo se realizará de acuerdo con la legislación aplicable.',
          'Las tecnologías estrictamente necesarias para ofrecer un servicio solicitado por el usuario podrán utilizarse sin consentimiento cuando así lo permita la legislación aplicable.',
          'Para las tecnologías que dependan del consentimiento, Pixgo ofrecerá mecanismos adecuados para permitir al usuario aceptar, rechazar o gestionar dichas tecnologías, cuando sea legalmente exigido.',
          'El consentimiento podrá retirarse o modificarse a través de los mecanismos ofrecidos por la Plataforma, sin perjuicio del uso de las tecnologías estrictamente necesarias para el funcionamiento del servicio.',
        ],
      },
      {
        heading: '13. Gestión de cookies desde el navegador',
        paragraphs: [
          'La mayoría de los navegadores permiten al usuario visualizar, bloquear, eliminar o restringir cookies a través de sus respectivas configuraciones de privacidad y seguridad.',
          'El usuario podrá configurar el navegador para rechazar determinadas cookies o para que le avise antes de permitir su almacenamiento.',
          'La gestión de cookies directamente en el navegador podrá afectar la experiencia de uso de Pixgo.',
          'El bloqueo de cookies esenciales o de determinadas tecnologías necesarias para la autenticación podrá impedir el funcionamiento de funcionalidades de la cuenta y de áreas protegidas de la Plataforma.',
        ],
      },
      {
        heading: '14. Eliminación de cookies',
        paragraphs: [
          'El usuario puede eliminar las cookies almacenadas en su dispositivo a través de la configuración del navegador utilizado.',
          'La eliminación de cookies podrá dar lugar a la pérdida de determinadas preferencias o a la necesidad de iniciar sesión nuevamente.',
          'Tras la eliminación, determinadas cookies podrán volver a crearse cuando el usuario vuelva a utilizar funcionalidades que dependan de ellas.',
        ],
      },
      {
        heading: '15. Duración de las cookies',
        paragraphs: [
          'Las cookies pueden tener diferentes períodos de validez.',
          'Algunas existen solo durante la sesión de navegación y se eliminan cuando esta finaliza. Otras podrán permanecer en el dispositivo durante un período determinado, de acuerdo con la finalidad para la que fueron configuradas.',
          'La duración concreta podrá variar en función de la categoría de la cookie, la funcionalidad correspondiente, las configuraciones técnicas y las exigencias legales aplicables.',
        ],
      },
      {
        heading: '16. Cambios en las cookies utilizadas',
        paragraphs: [
          'Pixgo podrá modificar las tecnologías utilizadas en la Plataforma en función de la evolución de los servicios, los requisitos de seguridad, los cambios técnicos, la introducción de nuevas funcionalidades o la integración de nuevos proveedores.',
          'El cambio de tecnologías podrá implicar la introducción, sustitución o eliminación de determinadas cookies.',
          'Cuando un cambio relevante exija nueva información o consentimiento conforme a la legislación aplicable, se adoptarán los mecanismos adecuados.',
        ],
      },
      {
        heading: '17. Privacidad',
        paragraphs: [
          'Las cookies podrán estar asociadas a información técnica o, en determinadas circunstancias, a información relacionada con un usuario o dispositivo.',
          'El tratamiento de datos personales que eventualmente esté asociado al uso de cookies se rige por la Política de Privacidad de Pixgo.',
          'La presente Política de Cookies debe, por ello, interpretarse conjuntamente con la Política de Privacidad, que establece las reglas aplicables al tratamiento de datos personales.',
        ],
      },
      {
        heading: '18. Derechos del usuario',
        paragraphs: [
          'El usuario podrá ejercer los derechos que le confiera la legislación aplicable respecto del tratamiento de sus datos personales y del uso de tecnologías de rastreo o almacenamiento.',
          'Según la legislación aplicable, estos derechos podrán incluir el derecho de acceso, rectificación, eliminación, oposición, limitación del tratamiento, retirada del consentimiento y otros derechos legalmente reconocidos.',
          'Las solicitudes relacionadas con la privacidad podrán presentarse a través de los canales oficiales de contacto ofrecidos por Pixgo.',
        ],
      },
      {
        heading: '19. Actualización de la política',
        paragraphs: [
          'Pixgo podrá actualizar esta Política de Cookies siempre que sea necesario para reflejar cambios en la Plataforma, en las tecnologías utilizadas, en los proveedores, en los requisitos legales o en las prácticas de tratamiento de información.',
          'La versión vigente se pondrá a disposición en la Plataforma e identificada por su fecha de actualización.',
          'Se recomienda al usuario consultar periódicamente esta página para conocer los posibles cambios relevantes.',
        ],
      },
      {
        heading: '20. Contacto',
        paragraphs: [
          'Para cuestiones relacionadas con cookies, tecnologías similares o privacidad, el usuario podrá contactar con Pixgo a través de los canales oficiales ofrecidos en la Plataforma.',
        ],
        contactEmail: 'support@pixgo.qzz.io',
      },
      {
        heading: '21. Versión de la política',
        paragraphs: [
          'La presente Política de Cookies corresponde a la versión publicada por Pixgo en agosto de 2026.',
          'La fecha indicada al inicio de esta página identifica la versión actualmente vigente.',
        ],
      },
    ],
  },
};

export default function CookiesPage() {
  const lang = useLegalLang();
  return <LegalLayout content={CONTENT[lang]} icon={<CookieOutlinedIcon style={{ fontSize: 26, color: 'var(--color-primary)' }} />} />;
}
