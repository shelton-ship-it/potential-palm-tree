'use client';
import React from 'react';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import LegalLayout, { LegalContent } from '../../components/legal/LegalLayout';
import { useLegalLang, LegalLang } from '../../lib/legalLang';

const CONTENT: Record<LegalLang, LegalContent> = {
  pt: {
    title: 'Quem somos',
    kicker: 'Institucional',
    subtitle: 'A plataforma Pixgo, os serviços disponibilizados e o modo como funcionam.',
    updated: 'Atualizado em agosto de 2026',
    sections: [
      {
        heading: 'O que é a Pixgo, em resumo',
        paragraphs: ['A Pixgo é uma plataforma digital destinada à disponibilização de serviços e soluções tecnológicas orientados para produtividade, criação, tratamento, transformação e gestão de conteúdos digitais. A plataforma procura concentrar diferentes funcionalidades num ambiente integrado, permitindo aos utilizadores aceder a serviços digitais através de uma única conta, com uma experiência de utilização uniforme e estruturada.'],
      },
      {
        heading: 'O que é a Pixgo',
        paragraphs: [
          'A Pixgo é um ecossistema digital construído para disponibilizar ferramentas e serviços de tratamento de ficheiros, documentos, imagens e outros conteúdos digitais. A plataforma foi concebida para dar acesso simplificado a capacidades tecnológicas que, tradicionalmente, exigiriam a utilização de várias aplicações ou serviços diferentes.',
          'Os serviços disponibilizados pela Pixgo podem ser utilizados diretamente através de interfaces digitais acessíveis por navegador, de acordo com as funcionalidades, limitações técnicas e condições aplicáveis a cada serviço.',
          'A utilização da plataforma implica a aceitação dos termos aplicáveis, das políticas de utilização e demais disposições legais publicadas pela Pixgo. Determinadas funcionalidades, capacidades ou limites de utilização podem variar consoante o tipo de conta ou o plano contratado pelo utilizador.',
          'A Pixgo reserva-se o direito de desenvolver, modificar, substituir, suspender ou descontinuar funcionalidades e serviços, no todo ou em parte, sempre que necessário por razões técnicas, operacionais, comerciais, de segurança, legais ou de evolução da plataforma.',
        ],
      },
      {
        heading: 'Conta de utilizador',
        paragraphs: [
          'A Pixgo disponibiliza um sistema de conta centralizado que permite ao utilizador aceder aos serviços compatíveis através de uma identidade digital única.',
          'O utilizador é responsável pela exatidão das informações fornecidas no registo, pela sua atualização e pela correta utilização das credenciais associadas à sua conta.',
          'As credenciais de acesso são pessoais e não devem ser partilhadas com terceiros. O utilizador deve adotar medidas razoáveis para manter os seus dados de autenticação confidenciais e comunicar à Pixgo qualquer utilização não autorizada ou suspeita da sua conta.',
          'A Pixgo pode aplicar medidas de segurança, autenticação, limitação de acesso ou suspensão temporária sempre que seja identificado um comportamento suscetível de comprometer a segurança da plataforma, dos seus utilizadores ou da sua infraestrutura técnica.',
          'A criação ou manutenção de uma conta não confere ao utilizador qualquer direito de propriedade sobre a plataforma, os seus sistemas, interfaces, marcas, código, conteúdos ou componentes tecnológicos.',
        ],
      },
      {
        heading: 'Serviços digitais',
        paragraphs: [
          'Os serviços da Pixgo são disponibilizados em formato digital e destinam-se a facilitar determinadas tarefas relacionadas com ficheiros, documentos, imagens e conteúdos digitais.',
          'A natureza, o âmbito e a disponibilidade das funcionalidades podem alterar-se ao longo do tempo. A Pixgo pode introduzir novas funcionalidades, melhorar as existentes, definir limites técnicos, modificar métodos de processamento ou alterar a forma como os serviços são apresentados.',
          'Alguns serviços podem depender de determinados formatos de ficheiro, requisitos técnicos, capacidade de processamento, compatibilidade com o navegador, disponibilidade de infraestrutura ou outros fatores que não estão sob controlo direto da Pixgo.',
          'A Pixgo não garante que todos os ficheiros, formatos, dispositivos, sistemas operativos ou ambientes tecnológicos permaneçam permanentemente compatíveis com todos os serviços que disponibiliza.',
        ],
      },
      {
        heading: 'Tratamento de conteúdos',
        paragraphs: [
          'A utilização dos serviços pode implicar o envio, carregamento, processamento, transformação, armazenamento temporário ou transmissão de ficheiros e outros conteúdos fornecidos pelo utilizador.',
          'O utilizador mantém os direitos que legalmente detenha sobre os conteúdos que submete na plataforma. A disponibilização desses conteúdos à Pixgo não transfere, por si só, quaisquer direitos de propriedade intelectual para a Pixgo.',
          'Ao utilizar os serviços, o utilizador declara que dispõe dos direitos, autorizações ou fundamentos legais necessários para o tratamento dos conteúdos submetidos na plataforma.',
          'O utilizador não deve utilizar a Pixgo para tratar conteúdos cuja utilização, reprodução, transformação, distribuição ou processamento viole direitos de terceiros ou disposições legais aplicáveis.',
          'A Pixgo pode adotar medidas técnicas destinadas a proteger a sua infraestrutura, prevenir abusos, detetar utilizações incompatíveis com as regras da plataforma e cumprir obrigações legais.',
        ],
      },
      {
        heading: 'Disponibilidade da plataforma',
        paragraphs: [
          'A Pixgo procura manter os seus serviços disponíveis de forma contínua e fiável, mas a disponibilidade permanente não constitui uma garantia absoluta.',
          'A plataforma pode ficar temporariamente indisponível devido a manutenção, atualizações, falhas técnicas, problemas de infraestrutura, interrupções de conectividade, incidentes de segurança, indisponibilidade de fornecedores tecnológicos, situações de força maior ou outras circunstâncias fora do controlo razoável da Pixgo.',
          'Sempre que técnica e operacionalmente possível, a Pixgo procurará realizar intervenções programadas de forma a reduzir o impacto sobre os utilizadores.',
          'A Pixgo pode ainda limitar temporariamente determinadas funcionalidades quando tal seja necessário para preservar a estabilidade, segurança ou integridade da plataforma.',
        ],
      },
      {
        heading: 'Planos e condições de utilização',
        paragraphs: [
          'A Pixgo pode disponibilizar diferentes modalidades de acesso, incluindo modalidades gratuitas e modalidades sujeitas a pagamento.',
          'As condições, funcionalidades, limites, preços, períodos de utilização e demais características de cada modalidade são apresentadas nas respetivas áreas da plataforma e podem ser alteradas de acordo com as condições aplicáveis.',
          'A modalidade gratuita pode apresentar limitações funcionais, limites de utilização, publicidade ou outras condições específicas.',
          'As modalidades pagas podem oferecer funcionalidades adicionais, maior capacidade de utilização ou outras vantagens definidas no plano correspondente.',
          'A contratação de um plano pago não confere ao utilizador um direito adquirido à manutenção permanente de determinada funcionalidade, limite ou característica da plataforma, salvo se estabelecido expressamente por contrato ou por disposição legal imperativa.',
        ],
      },
      {
        heading: 'Pagamentos e subscrições',
        paragraphs: [
          'Sempre que sejam disponibilizados serviços pagos, a contratação, renovação, cancelamento e demais condições financeiras estão sujeitas às condições apresentadas no momento da aquisição e às regras aplicáveis ao método de pagamento utilizado.',
          'Os preços apresentados na plataforma correspondem às condições comerciais em vigor no momento da contratação, salvo indicação expressa em contrário.',
          'A Pixgo pode alterar preços, planos ou condições comerciais para períodos futuros, respeitando os direitos legalmente aplicáveis aos utilizadores que já tenham contratado serviços.',
          'Quando uma subscrição seja renovável, a sua renovação ocorrerá de acordo com a periodicidade e as condições apresentadas no momento da contratação, salvo cancelamento efetuado dentro das condições aplicáveis.',
          'O utilizador é responsável por manter válidos os dados necessários ao processamento dos pagamentos e por assegurar que dispõe de autorização para utilizar o método de pagamento selecionado.',
        ],
      },
      {
        heading: 'Publicidade',
        paragraphs: [
          'A modalidade gratuita da Pixgo pode incluir publicidade como forma de financiar a prestação dos seus serviços.',
          'A publicidade apresentada pode variar consoante fatores técnicos, disponibilidade de anunciantes, localização, dispositivo, navegador, configuração da plataforma e outros critérios aplicáveis.',
          'A Pixgo não controla necessariamente o conteúdo de todos os anúncios apresentados por terceiros, e a presença de publicidade na plataforma não constitui uma recomendação, aprovação ou garantia relativamente aos produtos ou serviços anunciados.',
          'Os planos que incluam a remoção de publicidade estão sujeitos às condições específicas apresentadas na plataforma.',
        ],
      },
      {
        heading: 'Uso responsável',
        paragraphs: [
          'A utilização da Pixgo deve ser feita de forma lícita, responsável e compatível com a finalidade dos serviços.',
          'É proibida qualquer utilização suscetível de comprometer a segurança, disponibilidade, integridade ou funcionamento normal da plataforma.',
          'Não é permitido utilizar mecanismos automatizados, scripts, programas ou outros métodos destinados a explorar, sobrecarregar, contornar limitações, interferir ou obter acesso não autorizado aos sistemas da Pixgo.',
          'Também não é permitido tentar obter acesso a contas, dados, sistemas, interfaces, serviços ou recursos que não estejam legitimamente autorizados ao utilizador.',
          'A Pixgo pode adotar medidas técnicas ou administrativas contra utilizações abusivas, fraudulentas, automatizadas, maliciosas ou incompatíveis com as condições da plataforma.',
        ],
      },
      {
        heading: 'Segurança',
        paragraphs: [
          'A segurança dos utilizadores, dos conteúdos processados e da infraestrutura constitui uma prioridade operacional da Pixgo.',
          'São aplicadas medidas técnicas e organizativas destinadas a reduzir riscos relacionados com acesso não autorizado, utilização abusiva, perda de dados, interrupções e outros incidentes de segurança.',
          'Nenhum sistema digital pode, contudo, ser considerado absolutamente imune a falhas, ataques ou outros acontecimentos adversos. Por essa razão, a Pixgo não pode garantir uma segurança absoluta nem a inexistência permanente de vulnerabilidades.',
          'Os utilizadores devem também adotar práticas adequadas de segurança, incluindo a proteção das suas credenciais, a utilização de dispositivos fiáveis e a comunicação imediata de atividades suspeitas.',
        ],
      },
      {
        heading: 'Proteção de dados',
        paragraphs: [
          'O tratamento de dados pessoais no âmbito da Pixgo rege-se pela respetiva Política de Privacidade.',
          'A Pixgo procura limitar a recolha e a utilização de dados ao que é necessário para disponibilizar, proteger, manter e melhorar os seus serviços, bem como para cumprir as obrigações legais aplicáveis.',
          'A informação relativa às categorias de dados recolhidos, às finalidades do tratamento, à conservação, aos direitos dos titulares e a outras matérias relacionadas com a proteção de dados está estabelecida na Política de Privacidade da plataforma.',
        ],
      },
      {
        heading: 'Propriedade intelectual',
        paragraphs: [
          'A Pixgo e os seus elementos constitutivos, incluindo marcas, nomes, logótipos, interfaces, layouts, textos, elementos gráficos, código, sistemas, bases de dados, funcionalidades e demais componentes desenvolvidos ou licenciados pela plataforma, estão protegidos pelas normas aplicáveis de propriedade intelectual.',
          'Salvo autorização expressa ou disposição legal em contrário, não é permitido copiar, reproduzir, modificar, distribuir, comercializar, publicar, desmontar, realizar engenharia inversa ou explorar comercialmente qualquer componente da plataforma.',
          'A utilização dos serviços apenas confere uma autorização limitada para utilizar a plataforma de acordo com a sua finalidade e com as condições aplicáveis.',
          'Nenhuma disposição relativa à utilização da Pixgo deve ser interpretada como uma transferência de direitos de propriedade intelectual para o utilizador.',
        ],
      },
      {
        heading: 'Conteúdos de terceiros',
        paragraphs: [
          'A plataforma pode permitir ou facilitar o tratamento de conteúdos pertencentes a utilizadores ou a terceiros.',
          'A Pixgo não reivindica automaticamente a propriedade desses conteúdos, nem presume que todos os conteúdos submetidos tenham sido criados pelo utilizador que os envia.',
          'O utilizador é o único responsável por assegurar que detém os direitos necessários para utilizar e processar qualquer conteúdo submetido na plataforma.',
          'A existência de uma funcionalidade técnica capaz de processar determinado conteúdo não significa que a utilização desse conteúdo seja lícita ou autorizada.',
        ],
      },
      {
        heading: 'Limitações de responsabilidade',
        paragraphs: [
          'A Pixgo disponibiliza os seus serviços com o objetivo de proporcionar uma experiência digital funcional, segura e eficiente, dentro dos limites técnicos e operacionais existentes.',
          'Na medida permitida pela legislação aplicável, a Pixgo não é responsável por danos decorrentes de uma utilização inadequada dos serviços, de indisponibilidade causada por fatores externos, de falhas de terceiros, de perdas resultantes de uma utilização incorreta, de conteúdos submetidos pelos utilizadores ou de acontecimentos que estejam fora do controlo razoável da plataforma.',
          'O utilizador deve manter cópias de segurança dos conteúdos relevantes sempre que a sua conservação seja importante.',
          'A utilização de qualquer resultado produzido pela plataforma é da responsabilidade do utilizador, sobretudo quando esse resultado seja utilizado em contextos profissionais, comerciais, financeiros, administrativos ou jurídicos.',
        ],
      },
      {
        heading: 'Alterações aos serviços',
        paragraphs: [
          'A Pixgo encontra-se em desenvolvimento contínuo. Por essa razão, as funcionalidades, interfaces, requisitos técnicos, limites de utilização e demais características podem ser modificados.',
          'As alterações relevantes podem ser comunicadas através dos canais disponíveis na plataforma, sempre que adequado ou exigido.',
          'A continuação da utilização da plataforma após alterações devidamente comunicadas pode constituir a aceitação das condições atualizadas, quando permitido pela legislação aplicável.',
        ],
      },
      {
        heading: 'Suspensão e encerramento',
        paragraphs: [
          'A Pixgo pode suspender ou limitar o acesso a uma conta quando existam motivos relacionados com segurança, fraude, utilização abusiva, incumprimento das condições aplicáveis ou exigências legais.',
          'Sempre que as circunstâncias o permitam e a legislação aplicável o exija, o utilizador pode ser informado sobre a suspensão e os seus motivos.',
          'O utilizador pode deixar de utilizar a plataforma e, quando disponível, solicitar o encerramento da sua conta através dos mecanismos disponibilizados para o efeito.',
          'O encerramento da conta não elimina automaticamente as obrigações que, pela sua natureza, devam permanecer em vigor após o termo da relação de utilização.',
        ],
      },
      {
        heading: 'Evolução da Pixgo',
        paragraphs: [
          'A Pixgo está concebida como uma plataforma tecnológica em evolução permanente. O desenvolvimento de novos serviços, as melhorias de desempenho, as alterações de arquitetura, as atualizações de segurança e a introdução de novas funcionalidades fazem parte do funcionamento normal do projeto.',
          'A organização e apresentação dos serviços pode, por isso, alterar-se ao longo do tempo, sem que isso implique uma mudança na finalidade geral da plataforma.',
          'O objetivo da Pixgo é continuar a oferecer soluções digitais acessíveis, funcionais e integradas, reduzindo a complexidade associada à utilização de diferentes ferramentas e serviços digitais.',
        ],
      },
      {
        heading: 'Contacto e suporte',
        paragraphs: [
          'A Pixgo disponibiliza canais de suporte destinados a esclarecer dúvidas, comunicar problemas técnicos, apresentar sugestões e tratar questões relacionadas com a utilização da plataforma.',
          'Os pedidos devem ser apresentados através dos canais oficiais disponibilizados pela Pixgo.',
          'A equipa responsável procurará analisar e responder aos pedidos dentro de um prazo razoável, considerando a natureza, complexidade e urgência de cada pedido.',
        ],
      },
      {
        heading: 'Informação final',
        paragraphs: [
          'A informação apresentada nesta página tem como finalidade explicar a natureza, o funcionamento e os princípios gerais da Pixgo.',
          'A utilização concreta da plataforma está igualmente sujeita aos Termos de Serviço, à Política de Privacidade, à Política de Cookies, à Política de Direitos de Autor, às regras de segurança e aos demais documentos legais publicados pela Pixgo.',
          'Em caso de conflito entre uma descrição geral apresentada nesta página e uma disposição específica contida num documento contratual ou política aplicável, prevalecerá a disposição específica, nos termos permitidos pela legislação aplicável.',
          'A Pixgo reserva-se o direito de atualizar esta página sempre que necessário para refletir alterações na plataforma, no seu funcionamento, nos serviços disponibilizados ou no quadro legal aplicável.',
        ],
      },
    ],
  },
  en: {
    title: 'About us',
    kicker: 'About',
    subtitle: 'The Pixgo platform, the services it provides, and how they work.',
    updated: 'Updated August 2026',
    sections: [
      {
        heading: 'What Pixgo is, in short',
        paragraphs: ['Pixgo is a digital platform for providing technology services and solutions focused on productivity, creation, processing, transformation, and management of digital content. The platform brings different capabilities together into a single, integrated environment, letting users access digital services through one account, with a consistent and structured experience.'],
      },
      {
        heading: 'What Pixgo is',
        paragraphs: [
          'Pixgo is a digital ecosystem built to provide tools and services for processing files, documents, images, and other digital content. The platform was designed to give simplified access to technological capabilities that would traditionally require using several different applications or services.',
          'The services Pixgo provides can be used directly through browser-accessible digital interfaces, in line with the features, technical limitations, and conditions applicable to each service.',
          'Using the platform implies acceptance of the applicable terms, usage policies, and other legal provisions published by Pixgo. Certain features, capabilities, or usage limits may vary depending on the account type or plan contracted by the user.',
          'Pixgo reserves the right to develop, modify, replace, suspend, or discontinue features and services, in whole or in part, whenever necessary for technical, operational, commercial, security, legal, or platform-evolution reasons.',
        ],
      },
      {
        heading: 'User account',
        paragraphs: [
          'Pixgo provides a centralized account system that lets the user access compatible services through a single digital identity.',
          'The user is responsible for the accuracy of the information provided during registration, for keeping that information up to date, and for the proper use of the credentials associated with their account.',
          'Access credentials are personal and must not be shared with third parties. The user must take reasonable steps to keep their authentication data confidential and report to Pixgo any unauthorised or suspicious use of their account.',
          'Pixgo may apply security, authentication, access-limitation, or temporary-suspension measures whenever behaviour is identified that could compromise the security of the platform, its users, or its technical infrastructure.',
          'Creating or maintaining an account does not grant the user any ownership right over the platform, its systems, interfaces, brands, code, content, or technological components.',
        ],
      },
      {
        heading: 'Digital services',
        paragraphs: [
          'Pixgo\'s services are provided in digital form and are intended to facilitate certain tasks related to files, documents, images, and digital content.',
          'The nature, scope, and availability of features may change over time. Pixgo may introduce new features, improve existing ones, set technical limits, modify processing methods, or change how services are presented.',
          'Some services may depend on certain file formats, technical requirements, processing capacity, browser compatibility, infrastructure availability, or other factors outside Pixgo\'s direct control.',
          'Pixgo does not guarantee that every file, format, device, operating system, or technological environment will remain permanently compatible with every service it provides.',
        ],
      },
      {
        heading: 'Content processing',
        paragraphs: [
          'Using the services may involve sending, uploading, processing, transforming, temporarily storing, or transmitting files and other content provided by the user.',
          'The user retains whatever rights they legally hold over the content they submit to the platform. Making that content available to Pixgo does not, by itself, transfer intellectual property to Pixgo.',
          'By using the services, the user declares that they hold the rights, authorisations, or legal grounds necessary to process the content submitted to the platform.',
          'The user must not use Pixgo to process content whose use, reproduction, transformation, distribution, or processing would infringe third-party rights or applicable legal provisions.',
          'Pixgo may adopt technical measures designed to protect its infrastructure, prevent abuse, detect uses incompatible with the platform\'s rules, and comply with legal obligations.',
        ],
      },
      {
        heading: 'Platform availability',
        paragraphs: [
          'Pixgo seeks to keep its services continuously and reliably available, but permanent availability is not an absolute guarantee.',
          'The platform may be temporarily unavailable due to maintenance, updates, technical failures, infrastructure problems, connectivity interruptions, security incidents, unavailability of technology providers, force-majeure events, or other circumstances beyond Pixgo\'s reasonable control.',
          'Whenever technically and operationally possible, Pixgo will try to carry out scheduled interventions in a way that reduces the impact on users.',
          'Pixgo may also temporarily limit certain features when necessary to preserve the platform\'s stability, security, or integrity.',
        ],
      },
      {
        heading: 'Plans and terms of use',
        paragraphs: [
          'Pixgo may offer different access tiers, including free tiers and paid tiers.',
          'The conditions, features, limits, prices, usage periods, and other characteristics of each tier are presented in the relevant areas of the platform and may change according to the applicable conditions.',
          'The free tier may include functional limitations, usage limits, advertising, or other specific conditions.',
          'Paid tiers may offer additional features, greater usage capacity, or other advantages defined in the corresponding plan.',
          'Contracting a paid plan does not grant the user a vested right to the permanent continuation of any particular feature, limit, or characteristic of the platform, except where expressly established by contract or mandatory legal provision.',
        ],
      },
      {
        heading: 'Payments and subscriptions',
        paragraphs: [
          'Where paid services are offered, contracting, renewal, cancellation, and other financial conditions are subject to the terms presented at the time of purchase and to the rules applicable to the relevant payment method.',
          'The prices shown on the platform reflect the commercial conditions in effect at the time of contracting, unless expressly stated otherwise.',
          'Pixgo may change prices, plans, or commercial conditions for future periods, respecting the legal rights of users who have already contracted services.',
          'Where a subscription is renewable, its renewal will occur according to the periodicity and conditions presented at the time of contracting, unless cancelled within the applicable conditions.',
          'The user is responsible for keeping the data required for payment processing valid and for ensuring they are authorised to use the selected payment method.',
        ],
      },
      {
        heading: 'Advertising',
        paragraphs: [
          'Pixgo\'s free tier may include advertising as a way of funding the provision of its services.',
          'The advertising shown may vary depending on technical factors, advertiser availability, location, device, browser, platform configuration, and other applicable criteria.',
          'Pixgo does not necessarily control the content of every advertisement shown by third parties, and the presence of advertising on the platform does not constitute a recommendation, endorsement, or guarantee regarding the advertised products or services.',
          'Plans that include ad removal are subject to the specific conditions presented on the platform.',
        ],
      },
      {
        heading: 'Responsible use',
        paragraphs: [
          'Use of Pixgo must be lawful, responsible, and consistent with the purpose of the services.',
          'Any use that could compromise the security, availability, integrity, or normal operation of the platform is prohibited.',
          'Using automated mechanisms, scripts, programs, or other methods intended to exploit, overload, circumvent limitations, interfere with, or gain unauthorised access to Pixgo\'s systems is not permitted.',
          'Attempting to gain access to accounts, data, systems, interfaces, services, or resources not legitimately authorised to the user is also not permitted.',
          'Pixgo may adopt technical or administrative measures against abusive, fraudulent, automated, malicious, or otherwise non-compliant uses of the platform.',
        ],
      },
      {
        heading: 'Security',
        paragraphs: [
          'The security of users, of processed content, and of the infrastructure is an operational priority for Pixgo.',
          'Technical and organisational measures are applied to reduce risks related to unauthorised access, abusive use, data loss, interruptions, and other security incidents.',
          'No digital system, however, can be considered absolutely immune to failures, attacks, or other adverse events. For that reason, Pixgo cannot guarantee absolute security or the permanent absence of vulnerabilities.',
          'Users must also adopt appropriate security practices, including protecting their credentials, using trusted devices, and promptly reporting suspicious activity.',
        ],
      },
      {
        heading: 'Data protection',
        paragraphs: [
          'The processing of personal data within Pixgo is governed by its Privacy Policy.',
          'Pixgo seeks to limit the collection and use of data to what is necessary to provide, protect, maintain, and improve its services, as well as to comply with applicable legal obligations.',
          'Information about the categories of data collected, the purposes of processing, retention, data-subject rights, and other data-protection matters is set out in the platform\'s Privacy Policy.',
        ],
      },
      {
        heading: 'Intellectual property',
        paragraphs: [
          'Pixgo and its constituent elements — including trademarks, names, logos, interfaces, layouts, text, graphic elements, code, systems, databases, features, and other components developed or licensed by the platform — are protected under applicable intellectual property law.',
          'Except with express authorisation or a legal provision stating otherwise, it is not permitted to copy, reproduce, modify, distribute, sell, publish, disassemble, reverse-engineer, or commercially exploit any component of the platform.',
          'Using the services only grants a limited authorisation to use the platform in accordance with its purpose and applicable conditions.',
          'No provision relating to the use of Pixgo should be interpreted as a transfer of intellectual property rights to the user.',
        ],
      },
      {
        heading: 'Third-party content',
        paragraphs: [
          'The platform may allow or facilitate the processing of content belonging to users or third parties.',
          'Pixgo does not automatically claim ownership of that content and does not assume that all submitted content was created by the user submitting it.',
          'The user is solely responsible for ensuring they hold the rights necessary to use and process any content submitted to the platform.',
          'The existence of a technical feature capable of processing certain content does not mean that using that content is legal or authorised.',
        ],
      },
      {
        heading: 'Limitation of liability',
        paragraphs: [
          'Pixgo provides its services with the aim of delivering a functional, secure, and efficient digital experience, within existing technical and operational limits.',
          'To the extent permitted by applicable law, Pixgo will not be liable for damages arising from improper use of the services, unavailability caused by external factors, third-party failures, loss resulting from incorrect use, content submitted by users, or events beyond the platform\'s reasonable control.',
          'The user must keep backup copies of relevant content whenever its preservation is important.',
          'Use of any result produced by the platform is the user\'s responsibility, especially when that result is used in professional, commercial, financial, administrative, or legal contexts.',
        ],
      },
      {
        heading: 'Changes to the services',
        paragraphs: [
          'Pixgo is under continuous development. For that reason, features, interfaces, technical requirements, usage limits, and other characteristics may be modified.',
          'Significant changes may be communicated through the channels available on the platform whenever appropriate or required.',
          'Continued use of the platform after changes that have been duly communicated may constitute acceptance of the updated conditions, where permitted by applicable law.',
        ],
      },
      {
        heading: 'Suspension and closure',
        paragraphs: [
          'Pixgo may suspend or limit access to an account when there are grounds related to security, fraud, abusive use, non-compliance with applicable conditions, or legal requirements.',
          'Whenever circumstances allow and applicable law requires it, the user may be informed of the suspension and its grounds.',
          'The user may stop using the platform and, where available, request the closure of their account through the mechanisms provided.',
          'Closing an account does not automatically eliminate obligations that, by their nature, must remain valid after the end of the usage relationship.',
        ],
      },
      {
        heading: 'Pixgo\'s evolution',
        paragraphs: [
          'Pixgo is designed as a technology platform in permanent evolution. Developing new services, performance improvements, architectural changes, security updates, and the introduction of new features are part of the project\'s normal operation.',
          'The organisation and presentation of the services may therefore change over time without that implying a change to the platform\'s overall purpose.',
          'Pixgo\'s goal is to keep providing accessible, functional, and integrated digital solutions, reducing the complexity associated with using different digital tools and services.',
        ],
      },
      {
        heading: 'Contact and support',
        paragraphs: [
          'Pixgo provides support channels for clarifying questions, reporting technical problems, submitting suggestions, and handling matters related to the use of the platform.',
          'Requests must be submitted through Pixgo\'s official channels.',
          'The responsible team will review and respond to requests within a reasonable time frame, considering the nature, complexity, and urgency of each request.',
        ],
      },
      {
        heading: 'Final notes',
        paragraphs: [
          'The information on this page is intended to explain the nature, operation, and general principles of Pixgo.',
          'Actual use of the platform is also subject to the Terms of Service, Privacy Policy, Cookie Policy, Copyright Policy, security rules, and other legal documents published by Pixgo.',
          'In case of conflict between a general description on this page and a specific provision in a contractual document or applicable policy, the specific provision will prevail to the extent permitted by applicable law.',
          'Pixgo reserves the right to update this page whenever necessary to reflect changes to the platform, its operation, the services provided, or the applicable legal framework.',
        ],
      },
    ],
  },
  es: {
    title: 'Quiénes somos',
    kicker: 'Institucional',
    subtitle: 'La plataforma Pixgo, los servicios que ofrece y cómo funcionan.',
    updated: 'Actualizado en agosto de 2026',
    sections: [
      {
        heading: 'Qué es Pixgo, en resumen',
        paragraphs: ['Pixgo es una plataforma digital destinada a ofrecer servicios y soluciones tecnológicas orientadas a la productividad, creación, tratamiento, transformación y gestión de contenidos digitales. La plataforma busca reunir diferentes funcionalidades en un entorno integrado, permitiendo a los usuarios acceder a servicios digitales a través de una única cuenta, con una experiencia de uso uniforme y estructurada.'],
      },
      {
        heading: 'Qué es Pixgo',
        paragraphs: [
          'Pixgo constituye un ecosistema digital desarrollado para ofrecer herramientas y servicios destinados al tratamiento de archivos, documentos, imágenes y otros contenidos digitales. La plataforma fue concebida para proporcionar acceso simplificado a funcionalidades tecnológicas que, tradicionalmente, requerirían el uso de diferentes aplicaciones o servicios.',
          'Los servicios ofrecidos por Pixgo pueden utilizarse directamente a través de interfaces digitales accesibles por navegador, de acuerdo con las funcionalidades, limitaciones técnicas y condiciones aplicables a cada servicio.',
          'El uso de la plataforma presupone la aceptación de los términos aplicables, de las políticas de uso y de las demás disposiciones legales publicadas por Pixgo. Determinadas funcionalidades, capacidades o límites de uso pueden variar según el tipo de cuenta o plan contratado por el usuario.',
          'Pixgo se reserva el derecho de desarrollar, modificar, sustituir, suspender o descontinuar funcionalidades y servicios, total o parcialmente, siempre que sea necesario por razones técnicas, operativas, comerciales, de seguridad, legales o de evolución de la plataforma.',
        ],
      },
      {
        heading: 'Cuenta de usuario',
        paragraphs: [
          'Pixgo ofrece un sistema de cuenta centralizado que permite al usuario acceder a los servicios compatibles a través de una única identidad digital.',
          'El usuario es responsable de la exactitud de la información proporcionada durante el registro, de mantener dicha información actualizada y del uso adecuado de las credenciales asociadas a su cuenta.',
          'Las credenciales de acceso son personales y no deben compartirse con terceros. El usuario debe adoptar medidas razonables para preservar la confidencialidad de sus datos de autenticación y comunicar a Pixgo cualquier uso no autorizado o sospechoso de su cuenta.',
          'Pixgo podrá aplicar medidas de seguridad, autenticación, limitación de acceso o suspensión temporal siempre que se identifiquen comportamientos que puedan comprometer la seguridad de la plataforma, de sus usuarios o de la infraestructura tecnológica.',
          'La creación o el mantenimiento de una cuenta no otorga al usuario ningún derecho de propiedad sobre la plataforma, sus sistemas, interfaces, marcas, códigos, contenidos o componentes tecnológicos.',
        ],
      },
      {
        heading: 'Servicios digitales',
        paragraphs: [
          'Los servicios de Pixgo se ofrecen en formato digital y están destinados a facilitar determinadas tareas relacionadas con archivos, documentos, imágenes y contenidos digitales.',
          'La naturaleza, alcance y disponibilidad de las funcionalidades pueden cambiar con el tiempo. Pixgo podrá introducir nuevas funcionalidades, mejorar las existentes, establecer límites técnicos, modificar métodos de procesamiento o cambiar la forma de presentación de los servicios.',
          'Algunos servicios podrán depender de determinados formatos de archivo, requisitos técnicos, capacidad de procesamiento, compatibilidad del navegador, disponibilidad de infraestructura u otros factores ajenos al control directo de Pixgo.',
          'Pixgo no garantiza que todos los archivos, formatos, dispositivos, sistemas operativos o entornos tecnológicos sean permanentemente compatibles con todos los servicios ofrecidos.',
        ],
      },
      {
        heading: 'Procesamiento de contenidos',
        paragraphs: [
          'El uso de los servicios podrá implicar el envío, la carga, el procesamiento, la transformación, el almacenamiento temporal o la transmisión de archivos y otros contenidos proporcionados por el usuario.',
          'El usuario conserva los derechos que legalmente le correspondan sobre los contenidos que introduzca en la plataforma. Poner esos contenidos a disposición de Pixgo no implica, por sí solo, una transferencia de propiedad intelectual a Pixgo.',
          'Al utilizar los servicios, el usuario declara poseer los derechos, autorizaciones o fundamentos legales necesarios para procesar los contenidos enviados a la plataforma.',
          'El usuario no deberá utilizar Pixgo para procesar contenidos cuyo uso, reproducción, transformación, distribución o tratamiento vulnere derechos de terceros o disposiciones legales aplicables.',
          'Pixgo podrá adoptar medidas técnicas destinadas a proteger la infraestructura, prevenir abusos, detectar usos incompatibles con las reglas de la plataforma y cumplir obligaciones legales.',
        ],
      },
      {
        heading: 'Disponibilidad de la plataforma',
        paragraphs: [
          'Pixgo procura mantener sus servicios disponibles de forma continua y fiable, pero la disponibilidad permanente no constituye una garantía absoluta.',
          'La plataforma podrá quedar temporalmente indisponible debido a mantenimiento, actualizaciones, fallos técnicos, problemas de infraestructura, interrupciones de conectividad, incidentes de seguridad, indisponibilidad de proveedores tecnológicos, acontecimientos de fuerza mayor u otras circunstancias fuera del control razonable de Pixgo.',
          'Siempre que sea técnica y operativamente posible, Pixgo procurará realizar intervenciones programadas de forma que se reduzca el impacto sobre los usuarios.',
          'Pixgo también podrá limitar temporalmente determinadas funcionalidades cuando sea necesario para preservar la estabilidad, seguridad o integridad de la plataforma.',
        ],
      },
      {
        heading: 'Planes y condiciones de uso',
        paragraphs: [
          'Pixgo podrá ofrecer diferentes modalidades de acceso, incluyendo modalidades gratuitas y modalidades sujetas a pago.',
          'Las condiciones, funcionalidades, límites, precios, períodos de uso y demás características de cada modalidad se presentan en las respectivas áreas de la plataforma y pueden modificarse de acuerdo con las condiciones aplicables.',
          'La modalidad gratuita podrá presentar limitaciones funcionales, límites de uso, publicidad u otras condiciones específicas.',
          'Las modalidades de pago podrán ofrecer funcionalidades adicionales, mayor capacidad de uso u otras ventajas definidas en el plan correspondiente.',
          'La contratación de un plan de pago no otorga al usuario un derecho adquirido al mantenimiento permanente de determinada funcionalidad, límite o característica de la plataforma, salvo que se establezca expresamente por contrato o por disposición legal imperativa.',
        ],
      },
      {
        heading: 'Pagos y suscripciones',
        paragraphs: [
          'Cuando se ofrezcan servicios de pago, la contratación, renovación, cancelación y demás condiciones financieras estarán sujetas a las condiciones presentadas en el momento de la adquisición y a las reglas aplicables al método de pago correspondiente.',
          'Los precios presentados en la plataforma corresponden a las condiciones comerciales vigentes en el momento de la contratación, salvo indicación expresa en contrario.',
          'Pixgo podrá modificar precios, planes o condiciones comerciales para períodos futuros, respetando los derechos legalmente aplicables a los usuarios que ya hayan contratado servicios.',
          'Cuando una suscripción sea renovable, su renovación se producirá de acuerdo con la periodicidad y las condiciones presentadas en el momento de la contratación, salvo cancelación efectuada dentro de las condiciones aplicables.',
          'El usuario es responsable de mantener válidos los datos necesarios para el procesamiento de los pagos y de asegurarse de que dispone de autorización para utilizar el método de pago seleccionado.',
        ],
      },
      {
        heading: 'Publicidad',
        paragraphs: [
          'La modalidad gratuita de Pixgo podrá incluir publicidad como forma de financiar la prestación de los servicios.',
          'La presentación de publicidad podrá variar según factores técnicos, disponibilidad de los anunciantes, ubicación, dispositivo, navegador, configuración de la plataforma y otros criterios aplicables.',
          'Pixgo no controla necesariamente el contenido de todos los anuncios presentados por terceros, y la presencia de publicidad en la plataforma no constituye una recomendación, aprobación o garantía respecto de los productos o servicios anunciados.',
          'Los planes que incluyan la eliminación de publicidad estarán sujetos a las condiciones específicas presentadas en la plataforma.',
        ],
      },
      {
        heading: 'Uso responsable',
        paragraphs: [
          'El uso de Pixgo debe realizarse de forma legítima, responsable y compatible con la finalidad de los servicios.',
          'Queda prohibido cualquier uso que pueda comprometer la seguridad, disponibilidad, integridad o funcionamiento normal de la plataforma.',
          'No está permitido utilizar mecanismos automatizados, scripts, programas u otros métodos destinados a explotar, sobrecargar, eludir limitaciones, interferir u obtener acceso no autorizado a los sistemas de Pixgo.',
          'Tampoco está permitido intentar obtener acceso a cuentas, datos, sistemas, interfaces, servicios o recursos que no estén legítimamente autorizados al usuario.',
          'Pixgo podrá adoptar medidas técnicas o administrativas contra usos abusivos, fraudulentos, automatizados, maliciosos o incompatibles con las condiciones de la plataforma.',
        ],
      },
      {
        heading: 'Seguridad',
        paragraphs: [
          'La seguridad de los usuarios, de los contenidos procesados y de la infraestructura constituye una prioridad operativa de Pixgo.',
          'Se aplican medidas técnicas y organizativas destinadas a reducir riesgos relacionados con el acceso no autorizado, el uso abusivo, la pérdida de datos, las interrupciones y otros incidentes de seguridad.',
          'Ningún sistema digital puede, sin embargo, considerarse absolutamente inmune a fallos, ataques u otros acontecimientos adversos. Por ello, Pixgo no puede garantizar una seguridad absoluta ni la inexistencia permanente de vulnerabilidades.',
          'Los usuarios también deben adoptar prácticas adecuadas de seguridad, incluyendo la protección de sus credenciales, el uso de dispositivos confiables y la comunicación inmediata de actividades sospechosas.',
        ],
      },
      {
        heading: 'Protección de datos',
        paragraphs: [
          'El tratamiento de datos personales realizado en el ámbito de Pixgo se rige por la respectiva Política de Privacidad.',
          'Pixgo procura limitar la recopilación y el uso de datos a lo necesario para ofrecer, proteger, mantener y mejorar sus servicios, así como para cumplir con las obligaciones legales aplicables.',
          'La información relativa a las categorías de datos recopilados, las finalidades del tratamiento, la conservación, los derechos de los titulares y demás materias relacionadas con la protección de datos se encuentra establecida en la Política de Privacidad de la plataforma.',
        ],
      },
      {
        heading: 'Propiedad intelectual',
        paragraphs: [
          'Pixgo y sus elementos constitutivos, incluyendo marcas, nombres, logotipos, interfaces, diseños, textos, elementos gráficos, código, sistemas, bases de datos, funcionalidades y demás componentes desarrollados o licenciados por la plataforma, están protegidos por las normas aplicables de propiedad intelectual.',
          'Salvo autorización expresa o disposición legal que establezca lo contrario, no está permitido copiar, reproducir, modificar, distribuir, comercializar, publicar, desensamblar, realizar ingeniería inversa o explotar comercialmente ningún componente de la plataforma.',
          'El uso de los servicios otorga únicamente una autorización limitada para utilizar la plataforma de acuerdo con su finalidad y con las condiciones aplicables.',
          'Ninguna disposición relativa al uso de Pixgo debe interpretarse como una transferencia de derechos de propiedad intelectual al usuario.',
        ],
      },
      {
        heading: 'Contenidos de terceros',
        paragraphs: [
          'La plataforma podrá permitir o facilitar el procesamiento de contenidos pertenecientes a usuarios o a terceros.',
          'Pixgo no reivindica automáticamente la propiedad de esos contenidos ni asume que todos los contenidos enviados hayan sido creados por el usuario que los envía.',
          'El usuario es el único responsable de asegurarse de que posee los derechos necesarios para utilizar y procesar cualquier contenido enviado a la plataforma.',
          'La existencia de una funcionalidad técnica capaz de procesar determinado contenido no significa que el uso de ese contenido sea legal o esté autorizado.',
        ],
      },
      {
        heading: 'Limitaciones de responsabilidad',
        paragraphs: [
          'Pixgo ofrece sus servicios con el objetivo de proporcionar una experiencia digital funcional, segura y eficiente, dentro de los límites técnicos y operativos existentes.',
          'En la medida permitida por la legislación aplicable, Pixgo no será responsable por daños derivados de un uso inadecuado de los servicios, de la indisponibilidad causada por factores externos, de fallos de terceros, de pérdidas resultantes de un uso incorrecto, de contenidos enviados por los usuarios o de acontecimientos que estén fuera del control razonable de la plataforma.',
          'El usuario debe mantener copias de seguridad de los contenidos relevantes cuando su conservación sea importante.',
          'El uso de cualquier resultado producido por la plataforma es responsabilidad del usuario, especialmente cuando dicho resultado se utilice en contextos profesionales, comerciales, financieros, administrativos o jurídicos.',
        ],
      },
      {
        heading: 'Cambios en los servicios',
        paragraphs: [
          'Pixgo se encuentra en desarrollo continuo. Por ese motivo, las funcionalidades, interfaces, requisitos técnicos, límites de uso y demás características podrán modificarse.',
          'Los cambios relevantes podrán comunicarse a través de los canales disponibles en la plataforma siempre que sea adecuado o exigido.',
          'La continuidad del uso de la plataforma tras cambios que hayan sido debidamente comunicados podrá constituir la aceptación de las condiciones actualizadas, cuando lo permita la legislación aplicable.',
        ],
      },
      {
        heading: 'Suspensión y cierre',
        paragraphs: [
          'Pixgo podrá suspender o limitar el acceso de una cuenta cuando existan motivos relacionados con seguridad, fraude, uso abusivo, incumplimiento de las condiciones aplicables o exigencias legales.',
          'Siempre que las circunstancias lo permitan y la legislación aplicable lo exija, el usuario podrá ser informado sobre la suspensión y sus motivos.',
          'El usuario podrá dejar de utilizar la plataforma y, cuando esté disponible, solicitar el cierre de su cuenta a través de los mecanismos habilitados.',
          'El cierre de la cuenta no elimina automáticamente las obligaciones que, por su naturaleza, deban permanecer vigentes tras el fin de la relación de uso.',
        ],
      },
      {
        heading: 'Evolución de Pixgo',
        paragraphs: [
          'Pixgo está concebida como una plataforma tecnológica en evolución permanente. El desarrollo de nuevos servicios, las mejoras de rendimiento, los cambios de arquitectura, las actualizaciones de seguridad y la introducción de nuevas funcionalidades forman parte del funcionamiento normal del proyecto.',
          'La organización y presentación de los servicios podrá, por ello, modificarse con el tiempo sin que eso implique un cambio en la finalidad general de la plataforma.',
          'El objetivo de Pixgo es seguir ofreciendo soluciones digitales accesibles, funcionales e integradas, reduciendo la complejidad asociada al uso de diferentes herramientas y servicios digitales.',
        ],
      },
      {
        heading: 'Contacto y soporte',
        paragraphs: [
          'Pixgo ofrece canales de soporte destinados a aclarar dudas, comunicar problemas técnicos, presentar sugerencias y atender cuestiones relacionadas con el uso de la plataforma.',
          'Las solicitudes deben presentarse a través de los canales oficiales ofrecidos por Pixgo.',
          'El equipo responsable procurará analizar y responder a las solicitudes dentro de un plazo razonable, considerando la naturaleza, complejidad y urgencia de cada solicitud.',
        ],
      },
      {
        heading: 'Información final',
        paragraphs: [
          'La información presentada en esta página tiene como finalidad explicar la naturaleza, el funcionamiento y los principios generales de Pixgo.',
          'El uso concreto de la plataforma está igualmente sujeto a los Términos de Servicio, la Política de Privacidad, la Política de Cookies, la Política de Derechos de Autor, las reglas de seguridad y demás documentos legales publicados por Pixgo.',
          'En caso de conflicto entre una descripción general presentada en esta página y una disposición específica contenida en un documento contractual o política aplicable, prevalecerá la disposición específica en los términos permitidos por la legislación aplicable.',
          'Pixgo se reserva el derecho de actualizar esta página siempre que sea necesario para reflejar cambios en la plataforma, en su funcionamiento, en los servicios ofrecidos o en el marco legal aplicable.',
        ],
      },
    ],
  },
};

export default function AboutPage() {
  const lang = useLegalLang();
  return <LegalLayout content={CONTENT[lang]} icon={<InfoOutlinedIcon style={{ fontSize: 26, color: 'var(--color-primary)' }} />} />;
}
