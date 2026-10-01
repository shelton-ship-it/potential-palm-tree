'use client';
import React from 'react';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import LegalLayout, { LegalContent } from '../../components/legal/LegalLayout';
import { useLegalLang, LegalLang } from '../../lib/legalLang';

const CONTENT: Record<LegalLang, LegalContent> = {
  pt: {
    title: 'Segurança e proteção de dados',
    kicker: 'Confiança e proteção',
    subtitle: 'Como os dados dos utilizadores são armazenados, tratados e protegidos na plataforma Pixgo.',
    updated: 'Atualizado em agosto de 2026',
    sections: [
      {
        heading: 'Compromisso com a segurança e a privacidade',
        paragraphs: [
          'Política relativa à segurança da informação, proteção de dados pessoais e tratamento de conteúdos na plataforma digital Pixgo.',
        ],
      },
      {
        heading: 'Compromisso com a segurança e a privacidade',
        paragraphs: [
          'A Pixgo reconhece a importância da proteção dos dados pessoais, das informações de conta e dos conteúdos submetidos pelos utilizadores.',
          'A segurança da informação constitui um componente essencial da operação da Plataforma. São adotadas medidas técnicas e organizacionais destinadas a proteger os dados contra acesso não autorizado, alteração indevida, divulgação ilícita, perda, destruição ou outras formas de tratamento incompatíveis com as finalidades legítimas da Plataforma.',
          'Nenhum sistema informático ou serviço de transmissão de dados pode garantir segurança absoluta. Por essa razão, as medidas de segurança da Pixgo são continuamente avaliadas e poderão ser atualizadas em função da evolução tecnológica, dos riscos identificados e das necessidades operacionais.',
        ],
      },
      {
        heading: 'Dados pessoais recolhidos',
        paragraphs: [
          'A Pixgo poderá recolher e tratar informações necessárias à criação e gestão de uma conta, à prestação dos serviços e ao cumprimento das obrigações aplicáveis.',
          'Dependendo da utilização da Plataforma, poderão ser tratados dados como:',
        ],
        list: [
          'nome;',
          'nome de utilizador;',
          'endereço de correio eletrónico, quando fornecido;',
          'credenciais de autenticação;',
          'informações relativas ao plano contratado;',
          'estado e histórico da subscrição;',
          'preferências da conta;',
          'informações técnicas necessárias ao funcionamento e segurança da Plataforma;',
          'informações relacionadas com a utilização dos serviços;',
          'informações necessárias ao tratamento de pedidos de suporte.',
        ],
        note: 'A quantidade e natureza dos dados tratados poderão variar de acordo com os serviços utilizados e com as configurações da conta. A Pixgo procura limitar a recolha de informações ao que seja necessário para as finalidades legítimas associadas ao funcionamento da Plataforma.',
      },
      {
        heading: 'Proteção das credenciais',
        paragraphs: [
          'As palavras-passe dos utilizadores não são armazenadas em texto simples.',
          'As credenciais são submetidas a mecanismos de proteção adequados antes de serem armazenadas, de modo a impedir que a palavra-passe original fique disponível em formato diretamente legível.',
          'A equipa da Pixgo não deverá ter acesso à palavra-passe original do utilizador através dos sistemas de armazenamento da Plataforma.',
          'O utilizador é responsável por manter a confidencialidade da sua palavra-passe e por não a disponibilizar a terceiros.',
          'Em caso de suspeita de acesso não autorizado, o utilizador deverá comunicar imediatamente a situação através dos canais oficiais de suporte.',
        ],
      },
      {
        heading: 'Autenticação e controlo de acesso',
        paragraphs: [
          'A Pixgo utiliza mecanismos de autenticação e controlo de acesso destinados a limitar o acesso às áreas protegidas da Plataforma.',
          'Os dados e sistemas internos são acessíveis de acordo com níveis de autorização definidos para as respetivas funções operacionais.',
          'O acesso administrativo é limitado a pessoas autorizadas e poderá estar sujeito a mecanismos adicionais de autenticação, registo e controlo.',
          'O princípio do menor privilégio é aplicado sempre que tecnicamente e operacionalmente adequado, procurando limitar o acesso interno aos recursos necessários para o desempenho das respetivas funções.',
        ],
      },
      {
        heading: 'Dados relacionados com a utilização',
        paragraphs: [
          'Durante a utilização da Plataforma, poderão ser registadas informações técnicas e operacionais necessárias para assegurar o funcionamento dos serviços.',
          'Essas informações poderão incluir dados relativos a sessões, eventos técnicos, utilização de funcionalidades, erros, desempenho, segurança e operações realizadas na conta.',
          'Determinados dados poderão ser utilizados para diagnóstico de problemas, prevenção de abuso, deteção de comportamentos anómalos, manutenção da infraestrutura e melhoria dos serviços.',
          'Quando os dados forem utilizados para análise estatística, a Pixgo procurará utilizar informações agregadas ou anonimizadas sempre que isso seja suficiente para a finalidade pretendida.',
        ],
      },
      {
        heading: 'Ficheiros e conteúdos submetidos',
        paragraphs: [
          'Os ficheiros e demais conteúdos enviados pelo utilizador para processamento são tratados com a finalidade de executar a operação solicitada.',
          'A Pixgo não adquire, pelo simples facto de receber ou processar um ficheiro, a propriedade do conteúdo submetido.',
          'O utilizador permanece responsável pelos direitos associados aos conteúdos que envia e deve assegurar que possui autorização legal para os utilizar e processar.',
          'Os conteúdos poderão ser submetidos a processamento técnico, armazenamento temporário, transmissão entre componentes da infraestrutura ou outras operações necessárias à execução do serviço solicitado.',
        ],
      },
      {
        heading: 'Retenção de ficheiros processados',
        paragraphs: [
          'Sempre que tecnicamente possível, os ficheiros utilizados em operações de processamento serão eliminados após a conclusão da operação ou depois de terminado o período de retenção necessário à prestação do serviço.',
          'Determinados ficheiros ou resultados poderão permanecer temporariamente armazenados quando isso seja necessário para concluir uma operação, disponibilizar o resultado ao utilizador, permitir uma nova tentativa após falha técnica ou assegurar o funcionamento normal do serviço.',
          'Os períodos de retenção podem variar de acordo com a natureza do serviço, os requisitos técnicos e as necessidades operacionais.',
          'A Pixgo poderá conservar determinadas informações quando exista uma obrigação legal, necessidade legítima de segurança, resolução de litígios, prevenção de fraude ou outra base jurídica que justifique a conservação.',
        ],
      },
      {
        heading: 'Finalidades do tratamento',
        paragraphs: [
          'Os dados tratados pela Pixgo poderão ser utilizados para:',
        ],
        list: [
          'criar e administrar contas de utilizadores;',
          'autenticar utilizadores;',
          'disponibilizar os serviços contratados;',
          'processar e gerir subscrições;',
          'processar pagamentos através de prestadores especializados;',
          'prestar suporte técnico;',
          'comunicar informações relevantes sobre a conta e os serviços;',
          'prevenir fraude e utilização abusiva;',
          'proteger a segurança da Plataforma;',
          'diagnosticar falhas e problemas técnicos;',
          'melhorar a estabilidade, desempenho e funcionalidade dos serviços;',
          'cumprir obrigações legais e regulamentares;',
          'exercer ou defender direitos legalmente reconhecidos.',
        ],
        note: 'A Pixgo não comercializa dados pessoais dos utilizadores como produto.',
      },
      {
        heading: 'Publicidade e dados dos utilizadores',
        paragraphs: [
          'A modalidade gratuita da Pixgo poderá apresentar publicidade.',
          'Quando sejam utilizados serviços publicitários de terceiros, o tratamento de determinadas informações poderá ocorrer de acordo com as condições e políticas dos respetivos fornecedores.',
          'A Pixgo não vende os dados pessoais dos utilizadores a anunciantes.',
          'Qualquer tratamento de dados relacionado com publicidade será realizado de acordo com a legislação aplicável e com as opções de consentimento disponibilizadas quando legalmente exigidas.',
        ],
      },
      {
        heading: 'Dados financeiros e pagamentos',
        paragraphs: [
          'Os pagamentos relativos a planos ou serviços pagos poderão ser processados por prestadores externos especializados em serviços de pagamento.',
          'Esses prestadores poderão recolher e tratar informações financeiras necessárias para autorizar e processar as transações.',
          'A Pixgo não pretende armazenar nos seus próprios sistemas os números completos de cartões de pagamento quando o processamento seja realizado diretamente por um prestador externo.',
          'As informações relacionadas com o estado da transação, plano contratado, pagamento, renovação ou cancelamento poderão ser recebidas pela Pixgo na medida necessária para administrar a subscrição e prestar os serviços correspondentes.',
          'O tratamento dos dados financeiros pelo prestador de pagamento estará igualmente sujeito às condições e políticas desse prestador.',
        ],
      },
      {
        heading: 'Transmissão de dados',
        paragraphs: [
          'As comunicações entre o dispositivo do utilizador e a infraestrutura da Pixgo são realizadas através de protocolos de comunicação protegidos sempre que tecnicamente aplicável.',
          'A utilização de HTTPS e de mecanismos de encriptação de transporte procura impedir que terceiros não autorizados possam facilmente intercetar ou interpretar os dados durante a transmissão.',
          'A proteção da comunicação não elimina os riscos associados a dispositivos comprometidos, redes inseguras, software malicioso ou outros fatores externos à infraestrutura da Pixgo.',
        ],
      },
      {
        heading: 'Armazenamento e infraestrutura',
        paragraphs: [
          'Os dados necessários ao funcionamento da Plataforma são armazenados em sistemas de infraestrutura sujeitos a mecanismos de controlo de acesso e segurança.',
          'A arquitetura de armazenamento poderá ser alterada ao longo do tempo em função de requisitos técnicos, desempenho, disponibilidade, segurança, escalabilidade ou utilização de fornecedores especializados.',
          'A localização física dos dados poderá variar de acordo com a infraestrutura utilizada e com os serviços tecnológicos necessários à operação da Plataforma.',
          'Quando sejam utilizados prestadores externos de infraestrutura ou processamento, estes poderão tratar determinados dados em nome da Pixgo e estarão sujeitos às condições contratuais e legais aplicáveis.',
        ],
      },
      {
        heading: 'Acesso interno aos dados',
        paragraphs: [
          'O acesso aos dados dos utilizadores por pessoal autorizado é limitado às situações em que seja necessário para o desempenho de funções relacionadas com a operação da Plataforma.',
          'Esse acesso poderá ocorrer para:',
        ],
        list: [
          'prestação de suporte;',
          'investigação de problemas técnicos;',
          'manutenção dos sistemas;',
          'resposta a incidentes de segurança;',
          'prevenção de fraude e abuso;',
          'cumprimento de obrigações legais;',
          'proteção dos direitos e da segurança da Pixgo, dos utilizadores ou de terceiros.',
        ],
        note: 'A Pixgo procura limitar o acesso interno ao mínimo necessário para a finalidade correspondente.',
      },
      {
        heading: 'Partilha com prestadores de serviços',
        paragraphs: [
          'A Pixgo poderá recorrer a prestadores de serviços especializados para suportar determinadas funções da Plataforma.',
          'Esses prestadores poderão incluir serviços de infraestrutura, processamento, armazenamento, autenticação, pagamentos, segurança, comunicação ou outros serviços tecnológicos necessários à operação.',
          'Quando um prestador necessitar de acesso a dados pessoais para executar serviços em nome da Pixgo, esse tratamento deverá ocorrer dentro do âmbito necessário à respetiva prestação e de acordo com as obrigações aplicáveis.',
          'A Pixgo não autoriza a utilização dos dados para finalidades incompatíveis com as funções contratadas, salvo quando exista uma base jurídica independente para esse tratamento.',
        ],
      },
      {
        heading: 'Divulgação exigida por lei',
        paragraphs: [
          'A Pixgo poderá divulgar informações quando tal seja necessário para cumprir uma obrigação legal, uma ordem judicial, uma solicitação válida de autoridade competente ou outra determinação juridicamente vinculativa.',
          'A divulgação poderá também ocorrer quando seja necessária para investigar, prevenir ou responder a fraude, abuso, incidentes de segurança ou atividades potencialmente ilícitas, dentro dos limites permitidos pela legislação aplicável.',
          'Sempre que legalmente permitido, a Pixgo procurará limitar qualquer divulgação ao conjunto de informações necessário para cumprir a finalidade correspondente.',
        ],
      },
      {
        heading: 'Segurança operacional',
        paragraphs: [
          'A Pixgo procura manter medidas de segurança destinadas a reduzir os riscos associados à operação dos seus sistemas.',
          'Essas medidas poderão incluir:',
        ],
        list: [
          'controlo de acesso;',
          'autenticação;',
          'proteção das credenciais;',
          'encriptação das comunicações;',
          'monitorização técnica;',
          'registos de eventos de segurança;',
          'mecanismos de deteção de atividades anómalas;',
          'atualizações de software;',
          'correção de vulnerabilidades;',
          'medidas de proteção da infraestrutura;',
          'procedimentos de resposta a incidentes.',
        ],
        note: 'As medidas concretas poderão ser modificadas sem aviso prévio quando isso seja necessário para preservar a segurança dos sistemas.',
      },
      {
        heading: 'Incidentes de segurança',
        paragraphs: [
          'Apesar das medidas implementadas, não é possível eliminar completamente o risco de incidentes de segurança.',
          'Caso a Pixgo identifique um incidente que possa afetar dados pessoais e esteja sujeita a uma obrigação legal de comunicação, serão adotados os procedimentos exigidos pela legislação aplicável.',
          'Quando necessário, os utilizadores afetados poderão ser informados através dos canais considerados adequados, tendo em conta a natureza do incidente e as obrigações legais correspondentes.',
        ],
      },
      {
        heading: 'Conservação de dados pessoais',
        paragraphs: [
          'Os dados pessoais serão conservados durante o período necessário para cumprir as finalidades para as quais foram recolhidos, administrar a conta, prestar os serviços, cumprir obrigações legais, resolver disputas ou proteger direitos legítimos.',
          'O período concreto de conservação poderá variar de acordo com a natureza dos dados e a finalidade do tratamento.',
          'Após o término do período aplicável, os dados poderão ser eliminados, anonimizados ou mantidos apenas quando exista fundamento legal para a sua conservação.',
          'A eliminação de uma conta não implica necessariamente a eliminação imediata de todas as informações, quando determinados dados devam ser conservados por obrigação legal ou para finalidades legítimas de segurança e cumprimento.',
        ],
      },
      {
        heading: 'Eliminação de conta',
        paragraphs: [
          'O utilizador poderá solicitar o encerramento da sua conta através dos canais disponibilizados pela Pixgo.',
          'Após o encerramento, os dados associados à conta serão tratados de acordo com as políticas de retenção aplicáveis.',
          'Informações que não sejam necessárias para conservação poderão ser eliminadas ou anonimizadas.',
          'Determinados registos poderão permanecer durante o período necessário para cumprir obrigações legais, prevenir fraude, resolver litígios ou proteger direitos legítimos.',
        ],
      },
      {
        heading: 'Direitos dos utilizadores',
        paragraphs: [
          'Nos termos da legislação aplicável, o utilizador poderá exercer direitos relacionados com os seus dados pessoais.',
          'Esses direitos poderão incluir:',
        ],
        list: [
          'acesso aos dados pessoais tratados pela Pixgo;',
          'correção de informações incorretas ou incompletas;',
          'eliminação de dados quando legalmente aplicável;',
          'limitação do tratamento em determinadas circunstâncias;',
          'oposição a determinados tratamentos;',
          'retirada do consentimento quando o tratamento se baseie no consentimento;',
          'portabilidade dos dados quando esse direito seja aplicável;',
          'apresentação de reclamação perante a autoridade de proteção de dados competente.',
        ],
        note: 'A extensão desses direitos depende da legislação aplicável ao tratamento e à situação concreta.',
      },
      {
        heading: 'Como exercer os direitos',
        paragraphs: [
          'Os pedidos relacionados com proteção de dados poderão ser apresentados através do canal oficial de suporte da Pixgo.',
          'O pedido deverá conter informações suficientes para permitir a identificação da conta e a compreensão da solicitação.',
          'A Pixgo poderá solicitar informações adicionais quando forem necessárias para confirmar a identidade do requerente ou impedir o acesso indevido a dados pessoais.',
          'Os pedidos serão analisados e respondidos dentro dos prazos previstos pela legislação aplicável.',
        ],
      },
      {
        heading: 'Proteção de menores',
        paragraphs: [
          'A utilização da Pixgo por menores está sujeita aos requisitos de idade e às regras estabelecidas pela legislação aplicável.',
          'Quando o tratamento de dados de menores exigir consentimento ou autorização de um representante legal, serão aplicados os mecanismos exigidos pela legislação correspondente.',
          'Caso a Pixgo tome conhecimento de que foram recolhidos dados pessoais em circunstâncias incompatíveis com os requisitos legais aplicáveis, poderá adotar medidas destinadas a corrigir a situação.',
        ],
      },
      {
        heading: 'Dados técnicos e segurança',
        paragraphs: [
          'A Pixgo poderá recolher determinadas informações técnicas necessárias para assegurar a segurança e o funcionamento da Plataforma.',
          'Essas informações poderão incluir identificadores técnicos, informações sobre o navegador, sistema operativo, dispositivo, endereço de rede, eventos de autenticação, erros e outros dados técnicos.',
          'Esses dados poderão ser utilizados para prevenção de fraude, deteção de abuso, investigação de incidentes, diagnóstico técnico, segurança da conta e manutenção da infraestrutura.',
          'A utilização desses dados será limitada às finalidades legítimas correspondentes e às exigências legais aplicáveis.',
        ],
      },
      {
        heading: 'Transferências internacionais',
        paragraphs: [
          'Dependendo da infraestrutura e dos prestadores utilizados pela Pixgo, determinados dados poderão ser processados ou armazenados em jurisdições diferentes daquela em que o utilizador se encontra.',
          'Quando existam transferências internacionais de dados pessoais sujeitas a requisitos legais específicos, a Pixgo procurará aplicar os mecanismos de proteção exigidos pela legislação aplicável.',
          'A utilização de fornecedores internacionais poderá ser necessária para garantir disponibilidade, segurança, desempenho ou funcionamento dos serviços.',
        ],
      },
      {
        heading: 'Segurança dos ficheiros',
        paragraphs: [
          'A Pixgo adota medidas destinadas a reduzir o risco de acesso não autorizado aos ficheiros processados através da Plataforma.',
          'O acesso aos conteúdos deverá ser limitado aos processos técnicos necessários à execução das operações solicitadas pelo utilizador.',
          'Quando um serviço exigir armazenamento temporário, esse armazenamento deverá ocorrer durante o período necessário à execução da respetiva operação, sujeito às limitações técnicas e operacionais aplicáveis.',
          'Os utilizadores devem evitar submeter conteúdos cuja exposição, mesmo temporária, possa representar riscos incompatíveis com a utilização do serviço.',
        ],
      },
      {
        heading: 'Responsabilidade do utilizador pela segurança',
        paragraphs: [
          'A proteção da conta também depende das medidas adotadas pelo próprio utilizador.',
          'O utilizador deve:',
        ],
        list: [
          'manter as credenciais de acesso confidenciais;',
          'utilizar uma palavra-passe adequada;',
          'evitar partilhar a conta com terceiros;',
          'utilizar dispositivos e navegadores atualizados;',
          'comunicar atividades suspeitas;',
          'manter cópias de segurança dos ficheiros importantes;',
          'evitar o envio de informações que não sejam necessárias para a utilização do serviço.',
        ],
        note: 'A Pixgo não pode assumir responsabilidade por comprometimentos resultantes exclusivamente de negligência, partilha voluntária de credenciais ou utilização insegura por parte do utilizador.',
      },
      {
        heading: 'Alterações às medidas de segurança',
        paragraphs: [
          'As tecnologias e práticas de segurança evoluem continuamente.',
          'A Pixgo poderá alterar as suas medidas técnicas e organizacionais sem aviso prévio sempre que necessário para responder a novas ameaças, vulnerabilidades, requisitos legais ou necessidades operacionais.',
          'A alteração de uma medida de segurança não constitui redução deliberada dos compromissos de proteção assumidos pela Pixgo.',
        ],
      },
      {
        heading: 'Relação com a Política de Privacidade',
        paragraphs: [
          'A presente política descreve aspetos relacionados com segurança, proteção de dados e tratamento de informações na Plataforma.',
          'A Política de Privacidade estabelece de forma complementar as regras aplicáveis à recolha, utilização, conservação e proteção de dados pessoais.',
          'Os dois documentos devem ser interpretados conjuntamente, juntamente com os Termos e Condições e demais políticas aplicáveis.',
        ],
      },
      {
        heading: 'Atualizações desta política',
        paragraphs: [
          'A Pixgo poderá atualizar esta política para refletir alterações nos serviços, na infraestrutura tecnológica, nas medidas de segurança, nos processos de tratamento de dados ou na legislação aplicável.',
          'A versão vigente será publicada na Plataforma e identificada pela respetiva data de atualização.',
          'Quando uma alteração exigir comunicação específica ou consentimento nos termos da legislação aplicável, serão adotados os procedimentos correspondentes.',
        ],
      },
      {
        heading: 'Contacto',
        paragraphs: [
          'Questões, pedidos ou comunicações relacionados com segurança e proteção de dados poderão ser enviados através do canal oficial de suporte da Pixgo.',
        ],
        contactEmail: 'support@pixgo.qzz.io',
      },
      {
        heading: 'Versão da política',
        paragraphs: [
          'A presente Política de Segurança e Proteção de Dados corresponde à versão publicada pela Pixgo em agosto de 2026.',
          'A data indicada no início desta página identifica a versão atualmente vigente.',
        ],
      },
    ],
  },
  en: {
    title: 'Security and data protection',
    kicker: 'Trust & protection',
    subtitle: 'How user data is stored, processed, and protected on the Pixgo platform.',
    updated: 'Updated August 2026',
    sections: [
      {
        heading: 'Our commitment to security and privacy',
        paragraphs: [
          'Policy on information security, personal data protection, and content processing on the Pixgo digital platform.',
        ],
      },
      {
        heading: '1. Commitment to security and privacy',
        paragraphs: [
          'Pixgo recognises the importance of protecting personal data, account information, and content submitted by users.',
          'Information security is an essential part of operating the Platform. Technical and organisational measures are adopted to protect data against unauthorised access, improper alteration, unlawful disclosure, loss, destruction, or other forms of processing incompatible with the Platform\'s legitimate purposes.',
          'No computer system or data-transmission service can guarantee absolute security. For that reason, Pixgo\'s security measures are continually assessed and may be updated in light of technological developments, identified risks, and operational needs.',
        ],
      },
      {
        heading: '2. Personal data collected',
        paragraphs: [
          'Pixgo may collect and process information necessary to create and manage an account, provide the services, and comply with applicable obligations.',
          'Depending on how the Platform is used, data such as the following may be processed:',
        ],
        list: [
          'name;',
          'username;',
          'email address, where provided;',
          'authentication credentials;',
          'information relating to the contracted plan;',
          'subscription status and history;',
          'account preferences;',
          'technical information necessary for the Platform\'s operation and security;',
          'information related to the use of the services;',
          'information necessary to handle support requests.',
        ],
        note: 'The amount and nature of the data processed may vary according to the services used and the account settings. Pixgo seeks to limit the collection of information to what is necessary for the legitimate purposes associated with operating the Platform.',
      },
      {
        heading: '3. Protection of credentials',
        paragraphs: [
          'User passwords are not stored in plain text.',
          'Credentials undergo appropriate protection mechanisms before being stored, so as to prevent the original password from being available in a directly readable format.',
          'The Pixgo team should not have access to the user\'s original password through the Platform\'s storage systems.',
          'The user is responsible for keeping their password confidential and for not disclosing it to third parties.',
          'If unauthorised access is suspected, the user must immediately report the situation through the official support channels.',
        ],
      },
      {
        heading: '4. Authentication and access control',
        paragraphs: [
          'Pixgo uses authentication and access-control mechanisms intended to restrict access to protected areas of the Platform.',
          'Internal data and systems are accessible according to authorisation levels defined for the corresponding operational roles.',
          'Administrative access is limited to authorised personnel and may be subject to additional authentication, logging, and control mechanisms.',
          'The principle of least privilege is applied whenever technically and operationally appropriate, seeking to limit internal access to the resources necessary to perform the corresponding functions.',
        ],
      },
      {
        heading: '5. Usage-related data',
        paragraphs: [
          'While the Platform is used, technical and operational information necessary to ensure the services function may be recorded.',
          'This information may include data relating to sessions, technical events, feature usage, errors, performance, security, and operations carried out on the account.',
          'Certain data may be used to diagnose problems, prevent abuse, detect anomalous behaviour, maintain infrastructure, and improve the services.',
          'Where data is used for statistical analysis, Pixgo will seek to use aggregated or anonymised information whenever that is sufficient for the intended purpose.',
        ],
      },
      {
        heading: '6. Files and content submitted',
        paragraphs: [
          'Files and other content sent by the user for processing are handled for the purpose of carrying out the requested operation.',
          'Pixgo does not acquire ownership of submitted content merely by receiving or processing a file.',
          'The user remains responsible for the rights associated with the content they submit and must ensure they have legal authorisation to use and process it.',
          'Content may undergo technical processing, temporary storage, transmission between infrastructure components, or other operations necessary to carry out the requested service.',
        ],
      },
      {
        heading: '7. Retention of processed files',
        paragraphs: [
          'Whenever technically possible, files used in processing operations will be deleted after the operation is completed or after the retention period necessary to provide the service ends.',
          'Certain files or results may remain temporarily stored where necessary to complete an operation, make the result available to the user, allow a retry after a technical failure, or ensure the service functions normally.',
          'Retention periods may vary according to the nature of the service, technical requirements, and operational needs.',
          'Pixgo may retain certain information where there is a legal obligation, a legitimate security need, dispute resolution, fraud prevention, or another legal basis justifying retention.',
        ],
      },
      {
        heading: '8. Purposes of processing',
        paragraphs: [
          'Data processed by Pixgo may be used to:',
        ],
        list: [
          'create and manage user accounts;',
          'authenticate users;',
          'provide the contracted services;',
          'process and manage subscriptions;',
          'process payments through specialised providers;',
          'provide technical support;',
          'communicate relevant information about the account and services;',
          'prevent fraud and abusive use;',
          'protect the Platform\'s security;',
          'diagnose failures and technical problems;',
          'improve the stability, performance, and functionality of the services;',
          'comply with legal and regulatory obligations;',
          'exercise or defend legally recognised rights.',
        ],
        note: 'Pixgo does not sell users\' personal data as a product.',
      },
      {
        heading: '9. Advertising and user data',
        paragraphs: [
          'Pixgo\'s free tier may display advertising.',
          'Where third-party advertising services are used, the processing of certain information may occur in accordance with the conditions and policies of the respective providers.',
          'Pixgo does not sell users\' personal data to advertisers.',
          'Any data processing related to advertising will be carried out in accordance with applicable law and the consent options provided where legally required.',
        ],
      },
      {
        heading: '10. Financial data and payments',
        paragraphs: [
          'Payments for paid plans or services may be processed by external providers specialised in payment services.',
          'These providers may collect and process financial information necessary to authorise and process transactions.',
          'Pixgo does not intend to store full payment card numbers in its own systems where processing is carried out directly by an external provider.',
          'Information relating to transaction status, contracted plan, payment, renewal, or cancellation may be received by Pixgo to the extent necessary to administer the subscription and provide the corresponding services.',
          'The processing of financial data by the payment provider will also be subject to that provider\'s own conditions and policies.',
        ],
      },
      {
        heading: '11. Data transmission',
        paragraphs: [
          'Communications between the user\'s device and Pixgo\'s infrastructure are carried out through protected communication protocols whenever technically applicable.',
          'The use of HTTPS and transport-encryption mechanisms seeks to prevent unauthorised third parties from easily intercepting or reading data during transmission.',
          'Protecting the communication does not eliminate risks associated with compromised devices, insecure networks, malicious software, or other factors external to Pixgo\'s infrastructure.',
        ],
      },
      {
        heading: '12. Storage and infrastructure',
        paragraphs: [
          'Data necessary for the Platform to function is stored in infrastructure systems subject to access-control and security mechanisms.',
          'The storage architecture may change over time based on technical requirements, performance, availability, security, scalability, or the use of specialised providers.',
          'The physical location of the data may vary according to the infrastructure used and the technological services necessary to operate the Platform.',
          'Where external infrastructure or processing providers are used, they may process certain data on Pixgo\'s behalf and will be subject to applicable contractual and legal conditions.',
        ],
      },
      {
        heading: '13. Internal access to data',
        paragraphs: [
          'Access to user data by authorised personnel is limited to situations where it is necessary to perform functions related to operating the Platform.',
          'This access may occur for:',
        ],
        list: [
          'providing support;',
          'investigating technical problems;',
          'maintaining systems;',
          'responding to security incidents;',
          'preventing fraud and abuse;',
          'complying with legal obligations;',
          'protecting the rights and security of Pixgo, users, or third parties.',
        ],
        note: 'Pixgo seeks to limit internal access to the minimum necessary for the corresponding purpose.',
      },
      {
        heading: '14. Sharing with service providers',
        paragraphs: [
          'Pixgo may use specialised service providers to support certain Platform functions.',
          'These providers may include infrastructure, processing, storage, authentication, payment, security, communication, or other technology services necessary for operation.',
          'Where a provider needs access to personal data to carry out services on Pixgo\'s behalf, that processing must occur within the scope necessary for the corresponding service and in accordance with applicable obligations.',
          'Pixgo does not authorise the use of data for purposes incompatible with the contracted functions, except where an independent legal basis exists for that processing.',
        ],
      },
      {
        heading: '15. Disclosure required by law',
        paragraphs: [
          'Pixgo may disclose information where necessary to comply with a legal obligation, a court order, a valid request from a competent authority, or another legally binding determination.',
          'Disclosure may also occur where necessary to investigate, prevent, or respond to fraud, abuse, security incidents, or potentially unlawful activity, within the limits permitted by applicable law.',
          'Whenever legally permitted, Pixgo will seek to limit any disclosure to the set of information necessary for the corresponding purpose.',
        ],
      },
      {
        heading: '16. Operational security',
        paragraphs: [
          'Pixgo seeks to maintain security measures intended to reduce the risks associated with operating its systems.',
          'These measures may include:',
        ],
        list: [
          'access control;',
          'authentication;',
          'credential protection;',
          'encryption of communications;',
          'technical monitoring;',
          'security event logging;',
          'anomalous-activity detection mechanisms;',
          'software updates;',
          'vulnerability remediation;',
          'infrastructure protection measures;',
          'incident response procedures.',
        ],
        note: 'The specific measures may be changed without prior notice where necessary to preserve system security.',
      },
      {
        heading: '17. Security incidents',
        paragraphs: [
          'Despite the measures implemented, the risk of security incidents cannot be completely eliminated.',
          'Where Pixgo identifies an incident that could affect personal data and is subject to a legal notification obligation, the procedures required by applicable law will be adopted.',
          'Where necessary, affected users may be informed through channels deemed appropriate, taking into account the nature of the incident and the corresponding legal obligations.',
        ],
      },
      {
        heading: '18. Retention of personal data',
        paragraphs: [
          'Personal data will be retained for the period necessary to fulfil the purposes for which it was collected, administer the account, provide the services, comply with legal obligations, resolve disputes, or protect legitimate rights.',
          'The specific retention period may vary according to the nature of the data and the purpose of processing.',
          'After the applicable period ends, data may be deleted, anonymised, or retained only where there is a legal basis for its retention.',
          'Closing an account does not necessarily mean the immediate deletion of all information, where certain data must be retained under a legal obligation or for legitimate security and compliance purposes.',
        ],
      },
      {
        heading: '19. Account deletion',
        paragraphs: [
          'The user may request closure of their account through the channels provided by Pixgo.',
          'After closure, data associated with the account will be handled in accordance with applicable retention policies.',
          'Information that is not necessary for retention may be deleted or anonymised.',
          'Certain records may remain for the period necessary to comply with legal obligations, prevent fraud, resolve disputes, or protect legitimate rights.',
        ],
      },
      {
        heading: '20. User rights',
        paragraphs: [
          'Under applicable law, the user may exercise rights relating to their personal data.',
          'These rights may include:',
        ],
        list: [
          'access to the personal data processed by Pixgo;',
          'correction of inaccurate or incomplete information;',
          'deletion of data where legally applicable;',
          'restriction of processing in certain circumstances;',
          'objection to certain processing;',
          'withdrawal of consent where the processing is based on consent;',
          'data portability where that right applies;',
          'lodging a complaint with the competent data-protection authority.',
        ],
        note: 'The scope of these rights depends on the law applicable to the processing and the specific situation.',
      },
      {
        heading: '21. How to exercise these rights',
        paragraphs: [
          'Requests related to data protection may be submitted through Pixgo\'s official support channel.',
          'The request must contain sufficient information to identify the account and understand the request.',
          'Pixgo may request additional information where necessary to confirm the requester\'s identity or prevent improper access to personal data.',
          'Requests will be reviewed and answered within the time limits provided by applicable law.',
        ],
      },
      {
        heading: '22. Protection of minors',
        paragraphs: [
          'Use of Pixgo by minors is subject to the age requirements and rules established by applicable law.',
          'Where processing the data of minors requires the consent or authorisation of a legal representative, the mechanisms required by the corresponding law will be applied.',
          'If Pixgo becomes aware that personal data has been collected in circumstances incompatible with applicable legal requirements, it may adopt measures to correct the situation.',
        ],
      },
      {
        heading: '23. Technical data and security',
        paragraphs: [
          'Pixgo may collect certain technical information necessary to ensure the security and operation of the Platform.',
          'This information may include technical identifiers, information about the browser, operating system, device, network address, authentication events, errors, and other technical data.',
          'This data may be used for fraud prevention, abuse detection, incident investigation, technical diagnosis, account security, and infrastructure maintenance.',
          'Use of this data will be limited to the corresponding legitimate purposes and applicable legal requirements.',
        ],
      },
      {
        heading: '24. International transfers',
        paragraphs: [
          'Depending on the infrastructure and providers used by Pixgo, certain data may be processed or stored in jurisdictions other than the one where the user is located.',
          'Where international transfers of personal data are subject to specific legal requirements, Pixgo will seek to apply the protection mechanisms required by applicable law.',
          'The use of international providers may be necessary to ensure availability, security, performance, or functioning of the services.',
        ],
      },
      {
        heading: '25. File security',
        paragraphs: [
          'Pixgo adopts measures intended to reduce the risk of unauthorised access to files processed through the Platform.',
          'Access to content should be limited to the technical processes necessary to carry out the operations requested by the user.',
          'Where a service requires temporary storage, that storage should occur for the period necessary to carry out the corresponding operation, subject to applicable technical and operational limitations.',
          'Users should avoid submitting content whose exposure, even temporary, could pose risks incompatible with the use of the service.',
        ],
      },
      {
        heading: '26. User responsibility for security',
        paragraphs: [
          'Protecting the account also depends on the measures adopted by the user themselves.',
          'The user should:',
        ],
        list: [
          'keep access credentials confidential;',
          'use a suitable password;',
          'avoid sharing the account with third parties;',
          'use updated devices and browsers;',
          'report suspicious activity;',
          'keep backup copies of important files;',
          'avoid submitting information that is not necessary to use the service.',
        ],
        note: 'Pixgo cannot take responsibility for compromises resulting exclusively from negligence, voluntary sharing of credentials, or insecure use by the user.',
      },
      {
        heading: '27. Changes to security measures',
        paragraphs: [
          'Security technologies and practices evolve continuously.',
          'Pixgo may change its technical and organisational measures without prior notice whenever necessary to respond to new threats, vulnerabilities, legal requirements, or operational needs.',
          'Changing a security measure does not constitute a deliberate reduction of the protection commitments made by Pixgo.',
        ],
      },
      {
        heading: '28. Relationship with the Privacy Policy',
        paragraphs: [
          'This policy describes aspects related to security, data protection, and information processing on the Platform.',
          'The Privacy Policy sets out, in complementary fashion, the rules applicable to the collection, use, retention, and protection of personal data.',
          'The two documents should be read together, along with the Terms and Conditions and other applicable policies.',
        ],
      },
      {
        heading: '29. Updates to this policy',
        paragraphs: [
          'Pixgo may update this policy to reflect changes to the services, technological infrastructure, security measures, data-processing procedures, or applicable law.',
          'The current version will be published on the Platform and identified by its update date.',
          'Where a change requires specific notice or consent under applicable law, the corresponding procedures will be adopted.',
        ],
      },
      {
        heading: '30. Contact',
        paragraphs: [
          'Questions, requests, or communications related to security and data protection may be sent through Pixgo\'s official support channel.',
        ],
        contactEmail: 'support@pixgo.qzz.io',
      },
      {
        heading: '31. Version of this policy',
        paragraphs: [
          'This Security and Data Protection Policy corresponds to the version published by Pixgo in August 2026.',
          'The date indicated at the top of this page identifies the currently effective version.',
        ],
      },
    ],
  },
  es: {
    title: 'Seguridad y protección de datos',
    kicker: 'Confianza y protección',
    subtitle: 'Cómo se almacenan, tratan y protegen los datos de los usuarios en la plataforma Pixgo.',
    updated: 'Actualizado en agosto de 2026',
    sections: [
      {
        heading: 'Compromiso con la seguridad y la privacidad',
        paragraphs: [
          'Política relativa a la seguridad de la información, la protección de datos personales y el tratamiento de contenidos en la plataforma digital Pixgo.',
        ],
      },
      {
        heading: '1. Compromiso con la seguridad y la privacidad',
        paragraphs: [
          'Pixgo reconoce la importancia de la protección de los datos personales, de la información de la cuenta y de los contenidos enviados por los usuarios.',
          'La seguridad de la información constituye un componente esencial del funcionamiento de la Plataforma. Se adoptan medidas técnicas y organizativas destinadas a proteger los datos frente al acceso no autorizado, la alteración indebida, la divulgación ilícita, la pérdida, la destrucción u otras formas de tratamiento incompatibles con las finalidades legítimas de la Plataforma.',
          'Ningún sistema informático o servicio de transmisión de datos puede garantizar una seguridad absoluta. Por ello, las medidas de seguridad de Pixgo se evalúan continuamente y podrán actualizarse en función de la evolución tecnológica, los riesgos identificados y las necesidades operativas.',
        ],
      },
      {
        heading: '2. Datos personales recopilados',
        paragraphs: [
          'Pixgo podrá recopilar y tratar la información necesaria para crear y gestionar una cuenta, prestar los servicios y cumplir las obligaciones aplicables.',
          'Según el uso de la Plataforma, podrán tratarse datos como:',
        ],
        list: [
          'nombre;',
          'nombre de usuario;',
          'dirección de correo electrónico, cuando se facilite;',
          'credenciales de autenticación;',
          'información relativa al plan contratado;',
          'estado e historial de la suscripción;',
          'preferencias de la cuenta;',
          'información técnica necesaria para el funcionamiento y la seguridad de la Plataforma;',
          'información relacionada con el uso de los servicios;',
          'información necesaria para tramitar las solicitudes de soporte.',
        ],
        note: 'La cantidad y naturaleza de los datos tratados podrá variar según los servicios utilizados y las configuraciones de la cuenta. Pixgo procura limitar la recopilación de información a lo necesario para las finalidades legítimas asociadas al funcionamiento de la Plataforma.',
      },
      {
        heading: '3. Protección de las credenciales',
        paragraphs: [
          'Las contraseñas de los usuarios no se almacenan en texto simple.',
          'Las credenciales se someten a mecanismos de protección adecuados antes de almacenarse, con el fin de impedir que la contraseña original esté disponible en un formato directamente legible.',
          'El equipo de Pixgo no debería tener acceso a la contraseña original del usuario a través de los sistemas de almacenamiento de la Plataforma.',
          'El usuario es responsable de mantener la confidencialidad de su contraseña y de no facilitarla a terceros.',
          'En caso de sospecha de acceso no autorizado, el usuario deberá comunicar de inmediato la situación a través de los canales oficiales de soporte.',
        ],
      },
      {
        heading: '4. Autenticación y control de acceso',
        paragraphs: [
          'Pixgo utiliza mecanismos de autenticación y control de acceso destinados a limitar el acceso a las áreas protegidas de la Plataforma.',
          'Los datos y sistemas internos son accesibles de acuerdo con niveles de autorización definidos para las respectivas funciones operativas.',
          'El acceso administrativo está limitado a personas autorizadas y podrá estar sujeto a mecanismos adicionales de autenticación, registro y control.',
          'El principio del privilegio mínimo se aplica siempre que sea técnica y operativamente adecuado, procurando limitar el acceso interno a los recursos necesarios para el desempeño de las respectivas funciones.',
        ],
      },
      {
        heading: '5. Datos relacionados con el uso',
        paragraphs: [
          'Durante el uso de la Plataforma, podrá registrarse información técnica y operativa necesaria para garantizar el funcionamiento de los servicios.',
          'Esta información podrá incluir datos relativos a sesiones, eventos técnicos, uso de funcionalidades, errores, rendimiento, seguridad y operaciones realizadas en la cuenta.',
          'Determinados datos podrán utilizarse para el diagnóstico de problemas, la prevención de abusos, la detección de comportamientos anómalos, el mantenimiento de la infraestructura y la mejora de los servicios.',
          'Cuando los datos se utilicen para análisis estadístico, Pixgo procurará utilizar información agregada o anonimizada siempre que sea suficiente para la finalidad pretendida.',
        ],
      },
      {
        heading: '6. Archivos y contenidos enviados',
        paragraphs: [
          'Los archivos y demás contenidos enviados por el usuario para su procesamiento se tratan con la finalidad de ejecutar la operación solicitada.',
          'Pixgo no adquiere, por el simple hecho de recibir o procesar un archivo, la propiedad del contenido enviado.',
          'El usuario sigue siendo responsable de los derechos asociados a los contenidos que envía y debe garantizar que dispone de autorización legal para utilizarlos y procesarlos.',
          'Los contenidos podrán someterse a procesamiento técnico, almacenamiento temporal, transmisión entre componentes de la infraestructura u otras operaciones necesarias para la ejecución del servicio solicitado.',
        ],
      },
      {
        heading: '7. Retención de archivos procesados',
        paragraphs: [
          'Siempre que sea técnicamente posible, los archivos utilizados en operaciones de procesamiento se eliminarán tras la finalización de la operación o una vez terminado el período de retención necesario para prestar el servicio.',
          'Determinados archivos o resultados podrán permanecer temporalmente almacenados cuando sea necesario para concluir una operación, poner el resultado a disposición del usuario, permitir un nuevo intento tras un fallo técnico o garantizar el funcionamiento normal del servicio.',
          'Los períodos de retención pueden variar según la naturaleza del servicio, los requisitos técnicos y las necesidades operativas.',
          'Pixgo podrá conservar determinada información cuando exista una obligación legal, una necesidad legítima de seguridad, resolución de litigios, prevención del fraude u otra base jurídica que justifique la conservación.',
        ],
      },
      {
        heading: '8. Finalidades del tratamiento',
        paragraphs: [
          'Los datos tratados por Pixgo podrán utilizarse para:',
        ],
        list: [
          'crear y administrar cuentas de usuarios;',
          'autenticar usuarios;',
          'ofrecer los servicios contratados;',
          'procesar y gestionar suscripciones;',
          'procesar pagos a través de proveedores especializados;',
          'prestar soporte técnico;',
          'comunicar información relevante sobre la cuenta y los servicios;',
          'prevenir el fraude y el uso abusivo;',
          'proteger la seguridad de la Plataforma;',
          'diagnosticar fallos y problemas técnicos;',
          'mejorar la estabilidad, el rendimiento y la funcionalidad de los servicios;',
          'cumplir obligaciones legales y reglamentarias;',
          'ejercer o defender derechos legalmente reconocidos.',
        ],
        note: 'Pixgo no comercializa los datos personales de los usuarios como producto.',
      },
      {
        heading: '9. Publicidad y datos de los usuarios',
        paragraphs: [
          'La modalidad gratuita de Pixgo podrá presentar publicidad.',
          'Cuando se utilicen servicios publicitarios de terceros, el tratamiento de determinada información podrá producirse de acuerdo con las condiciones y políticas de los respectivos proveedores.',
          'Pixgo no vende los datos personales de los usuarios a los anunciantes.',
          'Cualquier tratamiento de datos relacionado con publicidad se realizará de acuerdo con la legislación aplicable y con las opciones de consentimiento ofrecidas cuando sean legalmente exigidas.',
        ],
      },
      {
        heading: '10. Datos financieros y pagos',
        paragraphs: [
          'Los pagos relativos a planes o servicios de pago podrán ser procesados por proveedores externos especializados en servicios de pago.',
          'Estos proveedores podrán recopilar y tratar la información financiera necesaria para autorizar y procesar las transacciones.',
          'Pixgo no pretende almacenar en sus propios sistemas los números completos de las tarjetas de pago cuando el procesamiento sea realizado directamente por un proveedor externo.',
          'La información relacionada con el estado de la transacción, el plan contratado, el pago, la renovación o la cancelación podrá ser recibida por Pixgo en la medida necesaria para administrar la suscripción y prestar los servicios correspondientes.',
          'El tratamiento de los datos financieros por parte del proveedor de pagos también estará sujeto a las condiciones y políticas de dicho proveedor.',
        ],
      },
      {
        heading: '11. Transmisión de datos',
        paragraphs: [
          'Las comunicaciones entre el dispositivo del usuario y la infraestructura de Pixgo se realizan mediante protocolos de comunicación protegidos siempre que sea técnicamente aplicable.',
          'El uso de HTTPS y de mecanismos de cifrado de transporte procura impedir que terceros no autorizados puedan interceptar o interpretar fácilmente los datos durante la transmisión.',
          'La protección de la comunicación no elimina los riesgos asociados a dispositivos comprometidos, redes inseguras, software malicioso u otros factores externos a la infraestructura de Pixgo.',
        ],
      },
      {
        heading: '12. Almacenamiento e infraestructura',
        paragraphs: [
          'Los datos necesarios para el funcionamiento de la Plataforma se almacenan en sistemas de infraestructura sujetos a mecanismos de control de acceso y seguridad.',
          'La arquitectura de almacenamiento podrá modificarse con el tiempo en función de requisitos técnicos, rendimiento, disponibilidad, seguridad, escalabilidad o el uso de proveedores especializados.',
          'La ubicación física de los datos podrá variar según la infraestructura utilizada y los servicios tecnológicos necesarios para la operación de la Plataforma.',
          'Cuando se utilicen proveedores externos de infraestructura o procesamiento, estos podrán tratar determinados datos en nombre de Pixgo y estarán sujetos a las condiciones contractuales y legales aplicables.',
        ],
      },
      {
        heading: '13. Acceso interno a los datos',
        paragraphs: [
          'El acceso a los datos de los usuarios por parte del personal autorizado se limita a las situaciones en que sea necesario para el desempeño de funciones relacionadas con la operación de la Plataforma.',
          'Este acceso podrá producirse para:',
        ],
        list: [
          'la prestación de soporte;',
          'la investigación de problemas técnicos;',
          'el mantenimiento de los sistemas;',
          'la respuesta a incidentes de seguridad;',
          'la prevención del fraude y el abuso;',
          'el cumplimiento de obligaciones legales;',
          'la protección de los derechos y la seguridad de Pixgo, de los usuarios o de terceros.',
        ],
        note: 'Pixgo procura limitar el acceso interno al mínimo necesario para la finalidad correspondiente.',
      },
      {
        heading: '14. Compartición con proveedores de servicios',
        paragraphs: [
          'Pixgo podrá recurrir a proveedores de servicios especializados para respaldar determinadas funciones de la Plataforma.',
          'Estos proveedores podrán incluir servicios de infraestructura, procesamiento, almacenamiento, autenticación, pagos, seguridad, comunicación u otros servicios tecnológicos necesarios para la operación.',
          'Cuando un proveedor necesite acceso a datos personales para ejecutar servicios en nombre de Pixgo, dicho tratamiento deberá producirse dentro del ámbito necesario para la prestación correspondiente y de acuerdo con las obligaciones aplicables.',
          'Pixgo no autoriza el uso de los datos para finalidades incompatibles con las funciones contratadas, salvo que exista una base jurídica independiente para ese tratamiento.',
        ],
      },
      {
        heading: '15. Divulgación exigida por ley',
        paragraphs: [
          'Pixgo podrá divulgar información cuando sea necesario para cumplir una obligación legal, una orden judicial, una solicitud válida de una autoridad competente u otra determinación jurídicamente vinculante.',
          'La divulgación también podrá producirse cuando sea necesaria para investigar, prevenir o responder a fraudes, abusos, incidentes de seguridad o actividades potencialmente ilícitas, dentro de los límites permitidos por la legislación aplicable.',
          'Siempre que esté legalmente permitido, Pixgo procurará limitar cualquier divulgación al conjunto de información necesario para la finalidad correspondiente.',
        ],
      },
      {
        heading: '16. Seguridad operativa',
        paragraphs: [
          'Pixgo procura mantener medidas de seguridad destinadas a reducir los riesgos asociados a la operación de sus sistemas.',
          'Estas medidas podrán incluir:',
        ],
        list: [
          'control de acceso;',
          'autenticación;',
          'protección de las credenciales;',
          'cifrado de las comunicaciones;',
          'monitorización técnica;',
          'registros de eventos de seguridad;',
          'mecanismos de detección de actividades anómalas;',
          'actualizaciones de software;',
          'corrección de vulnerabilidades;',
          'medidas de protección de la infraestructura;',
          'procedimientos de respuesta a incidentes.',
        ],
        note: 'Las medidas concretas podrán modificarse sin previo aviso cuando sea necesario para preservar la seguridad de los sistemas.',
      },
      {
        heading: '17. Incidentes de seguridad',
        paragraphs: [
          'A pesar de las medidas implementadas, no es posible eliminar por completo el riesgo de incidentes de seguridad.',
          'Si Pixgo identifica un incidente que pueda afectar a datos personales y esté sujeta a una obligación legal de notificación, se adoptarán los procedimientos exigidos por la legislación aplicable.',
          'Cuando sea necesario, los usuarios afectados podrán ser informados a través de los canales que se consideren adecuados, teniendo en cuenta la naturaleza del incidente y las obligaciones legales correspondientes.',
        ],
      },
      {
        heading: '18. Conservación de datos personales',
        paragraphs: [
          'Los datos personales se conservarán durante el período necesario para cumplir las finalidades para las que fueron recopilados, administrar la cuenta, prestar los servicios, cumplir obligaciones legales, resolver disputas o proteger derechos legítimos.',
          'El período concreto de conservación podrá variar según la naturaleza de los datos y la finalidad del tratamiento.',
          'Tras finalizar el período aplicable, los datos podrán eliminarse, anonimizarse o conservarse únicamente cuando exista un fundamento legal para ello.',
          'La eliminación de una cuenta no implica necesariamente la eliminación inmediata de toda la información, cuando determinados datos deban conservarse por obligación legal o por finalidades legítimas de seguridad y cumplimiento.',
        ],
      },
      {
        heading: '19. Eliminación de la cuenta',
        paragraphs: [
          'El usuario podrá solicitar el cierre de su cuenta a través de los canales ofrecidos por Pixgo.',
          'Tras el cierre, los datos asociados a la cuenta se tratarán de acuerdo con las políticas de retención aplicables.',
          'La información que no sea necesaria para su conservación podrá eliminarse o anonimizarse.',
          'Determinados registros podrán permanecer durante el período necesario para cumplir obligaciones legales, prevenir fraudes, resolver litigios o proteger derechos legítimos.',
        ],
      },
      {
        heading: '20. Derechos de los usuarios',
        paragraphs: [
          'De acuerdo con la legislación aplicable, el usuario podrá ejercer derechos relacionados con sus datos personales.',
          'Estos derechos podrán incluir:',
        ],
        list: [
          'el acceso a los datos personales tratados por Pixgo;',
          'la corrección de información incorrecta o incompleta;',
          'la eliminación de datos cuando sea legalmente aplicable;',
          'la limitación del tratamiento en determinadas circunstancias;',
          'la oposición a determinados tratamientos;',
          'la retirada del consentimiento cuando el tratamiento se base en el consentimiento;',
          'la portabilidad de los datos cuando ese derecho sea aplicable;',
          'la presentación de una reclamación ante la autoridad de protección de datos competente.',
        ],
        note: 'El alcance de estos derechos depende de la legislación aplicable al tratamiento y de la situación concreta.',
      },
      {
        heading: '21. Cómo ejercer estos derechos',
        paragraphs: [
          'Las solicitudes relacionadas con la protección de datos podrán presentarse a través del canal oficial de soporte de Pixgo.',
          'La solicitud deberá contener información suficiente para permitir la identificación de la cuenta y la comprensión de la petición.',
          'Pixgo podrá solicitar información adicional cuando sea necesaria para confirmar la identidad del solicitante o impedir el acceso indebido a datos personales.',
          'Las solicitudes se analizarán y responderán dentro de los plazos previstos por la legislación aplicable.',
        ],
      },
      {
        heading: '22. Protección de menores',
        paragraphs: [
          'El uso de Pixgo por parte de menores está sujeto a los requisitos de edad y a las reglas establecidas por la legislación aplicable.',
          'Cuando el tratamiento de datos de menores requiera el consentimiento o la autorización de un representante legal, se aplicarán los mecanismos exigidos por la legislación correspondiente.',
          'Si Pixgo tiene conocimiento de que se han recopilado datos personales en circunstancias incompatibles con los requisitos legales aplicables, podrá adoptar medidas destinadas a corregir la situación.',
        ],
      },
      {
        heading: '23. Datos técnicos y seguridad',
        paragraphs: [
          'Pixgo podrá recopilar determinada información técnica necesaria para garantizar la seguridad y el funcionamiento de la Plataforma.',
          'Esta información podrá incluir identificadores técnicos, información sobre el navegador, el sistema operativo, el dispositivo, la dirección de red, eventos de autenticación, errores y otros datos técnicos.',
          'Estos datos podrán utilizarse para la prevención del fraude, la detección de abusos, la investigación de incidentes, el diagnóstico técnico, la seguridad de la cuenta y el mantenimiento de la infraestructura.',
          'El uso de estos datos se limitará a las finalidades legítimas correspondientes y a las exigencias legales aplicables.',
        ],
      },
      {
        heading: '24. Transferencias internacionales',
        paragraphs: [
          'Según la infraestructura y los proveedores utilizados por Pixgo, determinados datos podrán procesarse o almacenarse en jurisdicciones distintas a la del usuario.',
          'Cuando existan transferencias internacionales de datos personales sujetas a requisitos legales específicos, Pixgo procurará aplicar los mecanismos de protección exigidos por la legislación aplicable.',
          'El uso de proveedores internacionales podrá ser necesario para garantizar la disponibilidad, seguridad, rendimiento o funcionamiento de los servicios.',
        ],
      },
      {
        heading: '25. Seguridad de los archivos',
        paragraphs: [
          'Pixgo adopta medidas destinadas a reducir el riesgo de acceso no autorizado a los archivos procesados a través de la Plataforma.',
          'El acceso a los contenidos deberá limitarse a los procesos técnicos necesarios para la ejecución de las operaciones solicitadas por el usuario.',
          'Cuando un servicio requiera almacenamiento temporal, este deberá producirse durante el período necesario para la ejecución de la operación correspondiente, sujeto a las limitaciones técnicas y operativas aplicables.',
          'Los usuarios deben evitar enviar contenidos cuya exposición, incluso temporal, pueda representar riesgos incompatibles con el uso del servicio.',
        ],
      },
      {
        heading: '26. Responsabilidad del usuario por la seguridad',
        paragraphs: [
          'La protección de la cuenta también depende de las medidas adoptadas por el propio usuario.',
          'El usuario debe:',
        ],
        list: [
          'mantener confidenciales las credenciales de acceso;',
          'utilizar una contraseña adecuada;',
          'evitar compartir la cuenta con terceros;',
          'utilizar dispositivos y navegadores actualizados;',
          'comunicar actividades sospechosas;',
          'mantener copias de seguridad de los archivos importantes;',
          'evitar el envío de información que no sea necesaria para el uso del servicio.',
        ],
        note: 'Pixgo no puede asumir responsabilidad por compromisos derivados exclusivamente de la negligencia, la divulgación voluntaria de credenciales o el uso inseguro por parte del usuario.',
      },
      {
        heading: '27. Cambios en las medidas de seguridad',
        paragraphs: [
          'Las tecnologías y prácticas de seguridad evolucionan continuamente.',
          'Pixgo podrá modificar sus medidas técnicas y organizativas sin previo aviso siempre que sea necesario para responder a nuevas amenazas, vulnerabilidades, requisitos legales o necesidades operativas.',
          'La modificación de una medida de seguridad no constituye una reducción deliberada de los compromisos de protección asumidos por Pixgo.',
        ],
      },
      {
        heading: '28. Relación con la Política de Privacidad',
        paragraphs: [
          'La presente política describe aspectos relacionados con la seguridad, la protección de datos y el tratamiento de información en la Plataforma.',
          'La Política de Privacidad establece de forma complementaria las reglas aplicables a la recopilación, el uso, la conservación y la protección de datos personales.',
          'Ambos documentos deben interpretarse conjuntamente, junto con los Términos y Condiciones y las demás políticas aplicables.',
        ],
      },
      {
        heading: '29. Actualizaciones de esta política',
        paragraphs: [
          'Pixgo podrá actualizar esta política para reflejar cambios en los servicios, en la infraestructura tecnológica, en las medidas de seguridad, en los procesos de tratamiento de datos o en la legislación aplicable.',
          'La versión vigente se publicará en la Plataforma e identificada por su fecha de actualización.',
          'Cuando un cambio requiera una comunicación específica o el consentimiento conforme a la legislación aplicable, se adoptarán los procedimientos correspondientes.',
        ],
      },
      {
        heading: '30. Contacto',
        paragraphs: [
          'Las preguntas, solicitudes o comunicaciones relacionadas con la seguridad y la protección de datos podrán enviarse a través del canal oficial de soporte de Pixgo.',
        ],
        contactEmail: 'support@pixgo.qzz.io',
      },
      {
        heading: '31. Versión de la política',
        paragraphs: [
          'La presente Política de Seguridad y Protección de Datos corresponde a la versión publicada por Pixgo en agosto de 2026.',
          'La fecha indicada al inicio de esta página identifica la versión actualmente vigente.',
        ],
      },
    ],
  },
};

export default function SecurityPage() {
  const lang = useLegalLang();
  return <LegalLayout content={CONTENT[lang]} icon={<ShieldOutlinedIcon style={{ fontSize: 26, color: 'var(--color-primary)' }} />} />;
}
