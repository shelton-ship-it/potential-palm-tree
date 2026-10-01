'use client';
import React from 'react';
import CopyrightOutlinedIcon from '@mui/icons-material/CopyrightOutlined';
import LegalLayout, { LegalContent } from '../../components/legal/LegalLayout';
import { useLegalLang, LegalLang } from '../../lib/legalLang';

const CONTENT: Record<LegalLang, LegalContent> = {
  pt: {
    title: 'Direitos de autor',
    kicker: 'Propriedade intelectual',
    subtitle: 'Titularidade, exclusividade e condições de utilização da propriedade intelectual do Pixgo.',
    updated: 'Atualizado em agosto de 2026',
    sections: [
      {
        heading: 'Disposições gerais',
        paragraphs: [
          'Titularidade, proteção e condições de utilização da propriedade intelectual da plataforma digital Pixgo.',
        ],
      },
      {
        heading: 'Disposições gerais',
        paragraphs: [
          'A Pixgo respeita os direitos de propriedade intelectual próprios e de terceiros e considera a proteção desses direitos parte integrante da operação da Plataforma.',
          'A presente política estabelece as regras aplicáveis à propriedade intelectual relacionada com a Pixgo, incluindo software, código, interfaces, identidade visual, marcas, conteúdos, documentação, estruturas tecnológicas e demais elementos associados à Plataforma.',
          'A utilização da Pixgo não implica a transferência de qualquer direito de propriedade intelectual para o utilizador, salvo quando expressamente estabelecido ou quando tal resulte diretamente da legislação aplicável.',
        ],
      },
      {
        heading: 'Titularidade da Plataforma',
        paragraphs: [
          'Todos os direitos de propriedade intelectual relativos à Plataforma pertencem à Pixgo ou aos respetivos titulares de direitos, conforme aplicável.',
          'Estão abrangidos, entre outros:',
        ],
        list: [
          'código-fonte e código executável;',
          'arquitetura e estrutura dos sistemas;',
          'interfaces de utilizador;',
          'elementos de design;',
          'identidade visual;',
          'marcas e sinais distintivos;',
          'nomes e elementos gráficos;',
          'logótipos;',
          'ícones;',
          'textos e documentação;',
          'bases de dados;',
          'estruturas de informação;',
          'funcionalidades;',
          'componentes tecnológicos;',
          'elementos audiovisuais;',
          'materiais disponibilizados através da Plataforma.',
        ],
        note: 'Quando determinados elementos tenham sido licenciados à Pixgo por terceiros, a respetiva utilização permanece sujeita às condições e limitações estabelecidas pelos titulares dos direitos correspondentes.',
      },
      {
        heading: 'Direitos reservados',
        paragraphs: [
          'Salvo quando expressamente autorizado pela Pixgo ou permitido pela legislação aplicável, todos os direitos relacionados com a Plataforma permanecem reservados.',
          'A aquisição de uma subscrição ou a utilização gratuita dos serviços não concede ao utilizador qualquer direito de propriedade sobre o software, código, interfaces, marcas, design, arquitetura ou outros componentes da Plataforma.',
          'O utilizador recebe apenas o direito limitado de utilizar os serviços de acordo com a finalidade para a qual foram disponibilizados e com os Termos e Condições aplicáveis.',
        ],
      },
      {
        heading: 'Utilização autorizada',
        paragraphs: [
          'O utilizador poderá utilizar a Plataforma para as finalidades legítimas para as quais os serviços são disponibilizados.',
          'A utilização normal da interface, das funcionalidades e dos resultados produzidos a partir de conteúdos pertencentes ao utilizador não constitui infração de propriedade intelectual da Pixgo, desde que realizada de acordo com os Termos e Condições.',
          'Qualquer utilização que ultrapasse os direitos concedidos pela Pixgo ou pela legislação aplicável depende de autorização prévia do respetivo titular.',
        ],
      },
      {
        heading: 'Código e software',
        paragraphs: [
          'O código que integra a Plataforma constitui propriedade intelectual protegida.',
          'É proibida, salvo quando expressamente permitida pela legislação aplicável ou autorizada pela Pixgo:',
        ],
        list: [
          'reprodução do código;',
          'cópia substancial ou sistemática;',
          'distribuição;',
          'disponibilização pública;',
          'comercialização;',
          'sublicenciamento;',
          'modificação não autorizada;',
          'descompilação;',
          'desmontagem;',
          'engenharia reversa;',
          'tentativa de obtenção do código-fonte;',
          'criação de versões modificadas destinadas à redistribuição;',
          'utilização do código para desenvolvimento de serviços concorrentes.',
        ],
        note: 'As limitações previstas neste artigo aplicam-se tanto ao código integral como a partes substanciais da implementação da Plataforma.',
      },
      {
        heading: 'Design e interface',
        paragraphs: [
          'A estrutura visual, organização da interface, componentes gráficos, elementos de navegação e identidade visual da Pixgo constituem elementos protegidos pelos direitos aplicáveis.',
          'Não é permitida a reprodução substancial da aparência, organização ou apresentação da Plataforma com o objetivo de criar uma cópia, imitação ou serviço concorrente.',
          'A utilização de conceitos funcionais comuns ou de padrões técnicos geralmente utilizados no setor não constitui, por si só, apropriação indevida da propriedade intelectual da Pixgo.',
          'A proteção incide sobre os elementos concretos protegidos e não sobre ideias, conceitos ou funcionalidades que sejam livremente utilizáveis nos termos da legislação aplicável.',
        ],
      },
      {
        heading: 'Marcas e identidade da Pixgo',
        paragraphs: [
          'O nome Pixgo, respetivos sinais distintivos, logótipos, elementos de identidade visual e outras marcas utilizadas pela Plataforma pertencem à Pixgo ou são utilizados mediante autorização dos respetivos titulares.',
          'É proibida a utilização dessas marcas de forma suscetível de criar confusão quanto à origem, associação, patrocínio ou aprovação de determinado produto ou serviço.',
          'A utilização de marcas da Pixgo para fins comerciais, promocionais ou institucionais depende de autorização prévia, salvo quando legalmente permitida.',
        ],
      },
      {
        heading: 'Conteúdos disponibilizados pela Pixgo',
        paragraphs: [
          'Os textos, imagens, gráficos, elementos visuais, documentação, materiais informativos e demais conteúdos disponibilizados diretamente pela Pixgo encontram-se protegidos pelos direitos de propriedade intelectual aplicáveis.',
          'Esses conteúdos não podem ser reproduzidos, distribuídos, modificados ou explorados comercialmente sem autorização, salvo quando tal utilização seja expressamente permitida ou resulte de disposição legal.',
          'A consulta e utilização normal desses conteúdos no âmbito da Plataforma não implica transferência de direitos de propriedade.',
        ],
      },
      {
        heading: 'Conteúdos submetidos pelo utilizador',
        paragraphs: [
          'Os conteúdos enviados pelo utilizador para processamento permanecem sujeitos aos direitos de propriedade intelectual que legalmente lhes correspondam.',
          'A submissão de um ficheiro, documento, imagem ou outro conteúdo à Plataforma não transfere automaticamente a propriedade desse conteúdo para a Pixgo.',
          'O utilizador é responsável por garantir que possui os direitos, autorizações ou bases jurídicas necessárias para carregar, processar, modificar ou utilizar os conteúdos submetidos.',
          'A Pixgo não reivindica a propriedade dos conteúdos do utilizador exclusivamente pelo facto de os processar através dos seus serviços.',
        ],
      },
      {
        heading: 'Conteúdos produzidos através da Plataforma',
        paragraphs: [
          'Quando a Plataforma for utilizada para criar ou transformar conteúdos, a titularidade dos resultados será determinada pela natureza do conteúdo, pelos direitos preexistentes, pelas condições do serviço e pela legislação aplicável.',
          'Quando o resultado derivar de conteúdo fornecido pelo utilizador, a utilização da Plataforma não implica, por si só, transferência de propriedade para a Pixgo.',
          'O utilizador permanece responsável por verificar se possui todos os direitos necessários para utilizar, publicar, distribuir ou explorar os resultados produzidos.',
        ],
      },
      {
        heading: 'Direitos de terceiros',
        paragraphs: [
          'A Pixgo não autoriza a utilização da Plataforma para infringir direitos de propriedade intelectual de terceiros.',
          'O utilizador não deverá submeter, transformar, reproduzir, distribuir ou disponibilizar conteúdos protegidos quando não possua autorização ou outro fundamento jurídico que permita essa utilização.',
          'Caso a Pixgo receba uma comunicação válida relativa a uma alegada violação de direitos de propriedade intelectual, poderá analisar a situação e adotar as medidas legalmente adequadas.',
        ],
      },
      {
        heading: 'Distribuição da Plataforma',
        paragraphs: [
          'A disponibilização da Plataforma, das suas aplicações, componentes e ficheiros de instalação através de canais oficiais não constitui autorização geral para que terceiros os redistribuam.',
          'A cópia, redistribuição, alojamento, revenda ou disponibilização não autorizada de versões da Plataforma poderá constituir violação dos direitos aplicáveis.',
          'A Pixgo poderá disponibilizar determinadas versões através de diferentes canais oficiais, de acordo com as suas necessidades técnicas e operacionais.',
        ],
      },
      {
        heading: 'Aplicações e versões instaláveis',
        paragraphs: [
          'As aplicações e versões instaláveis da Pixgo constituem componentes da Plataforma e encontram-se sujeitas aos mesmos direitos de propriedade intelectual aplicáveis aos restantes componentes.',
          'A instalação de uma aplicação não transfere para o utilizador qualquer direito de propriedade sobre o software.',
          'É proibida a redistribuição não autorizada de ficheiros de instalação, versões modificadas ou cópias da aplicação.',
        ],
      },
      {
        heading: 'Engenharia reversa',
        paragraphs: [
          'Salvo nos casos em que a legislação aplicável expressamente permita determinada atividade, não é autorizada a realização de engenharia reversa, descompilação, desmontagem ou tentativa de reconstrução dos componentes internos da Plataforma.',
          'Também não é permitida a utilização de métodos destinados a obter código-fonte, chaves, credenciais, mecanismos internos, algoritmos ou componentes protegidos que não sejam disponibilizados publicamente pela Pixgo.',
          'Nada nesta disposição pretende restringir direitos que não possam legalmente ser excluídos.',
        ],
      },
      {
        heading: 'Criação de serviços derivados ou concorrentes',
        paragraphs: [
          'Não é permitida a utilização não autorizada de elementos protegidos da Pixgo para criar, reproduzir ou disponibilizar uma plataforma, aplicação ou serviço derivado.',
          'Esta restrição abrange a cópia substancial de código, interfaces, identidade visual, materiais protegidos, componentes proprietários ou outros elementos cuja reprodução seja protegida pela legislação aplicável.',
          'A presente disposição não impede o desenvolvimento independente de produtos ou serviços que utilizem conceitos, ideias, funcionalidades ou métodos que não sejam protegidos por direitos exclusivos.',
        ],
      },
      {
        heading: 'Licenças de terceiros',
        paragraphs: [
          'A Plataforma poderá incorporar componentes de software, bibliotecas, serviços ou outros elementos sujeitos a licenças de terceiros.',
          'Os respetivos direitos permanecem pertencentes aos titulares correspondentes.',
          'Quando uma licença de terceiros conceda direitos específicos ao utilizador, esses direitos serão preservados de acordo com os termos da respetiva licença.',
          'Nenhuma disposição desta política pretende atribuir à Pixgo direitos sobre componentes que pertençam a terceiros.',
        ],
      },
      {
        heading: 'Materiais de terceiros',
        paragraphs: [
          'A Plataforma poderá apresentar ou permitir o acesso a conteúdos pertencentes a terceiros.',
          'Esses conteúdos permanecem sujeitos aos direitos dos respetivos titulares.',
          'A utilização de conteúdos de terceiros deverá respeitar as condições estabelecidas pelos respetivos titulares e a legislação aplicável.',
          'A Pixgo não concede automaticamente uma licença sobre conteúdos de terceiros apenas por os disponibilizar ou permitir o seu processamento através da Plataforma.',
        ],
      },
      {
        heading: 'Comunicações relativas a violações',
        paragraphs: [
          'Qualquer pessoa que considere que os seus direitos de propriedade intelectual estão a ser violados através da Plataforma poderá comunicar a situação à Pixgo através dos canais oficiais de contacto.',
          'A comunicação deverá, sempre que possível, incluir informações suficientes para identificar:',
        ],
        list: [
          'o titular ou representante autorizado;',
          'o direito alegadamente violado;',
          'o conteúdo ou material em causa;',
          'a localização do conteúdo ou recurso na Plataforma;',
          'os fundamentos da alegação;',
          'informações de contacto para eventual pedido de esclarecimento.',
        ],
        note: 'A Pixgo poderá solicitar informações adicionais quando necessário para avaliar adequadamente a comunicação.',
      },
      {
        heading: 'Medidas perante alegadas violações',
        paragraphs: [
          'Após receber uma comunicação relacionada com propriedade intelectual, a Pixgo poderá analisar os elementos apresentados e adotar as medidas que considere adequadas nos termos da legislação aplicável.',
          'Dependendo das circunstâncias, poderão ser adotadas medidas como restrição de acesso, remoção de determinado conteúdo, suspensão de funcionalidades ou contacto com o utilizador responsável pelo conteúdo.',
          'A adoção de qualquer medida será realizada de acordo com a legislação aplicável e não constitui reconhecimento automático da validade de uma alegação apresentada por terceiros.',
        ],
      },
      {
        heading: 'Abuso de mecanismos de denúncia',
        paragraphs: [
          'Os mecanismos destinados à comunicação de violações de propriedade intelectual não devem ser utilizados para apresentar alegações falsas, fraudulentas ou deliberadamente enganosas.',
          'A utilização abusiva desses mecanismos poderá dar origem a medidas legalmente admissíveis.',
        ],
      },
      {
        heading: 'Proteção contra cópia não autorizada',
        paragraphs: [
          'A Pixgo poderá implementar medidas técnicas destinadas a proteger o software, os sistemas, os conteúdos e outros componentes contra cópia, acesso ou utilização não autorizada.',
          'A tentativa de remover, contornar ou neutralizar mecanismos de proteção poderá constituir violação destes Termos e Condições e dos direitos de propriedade intelectual aplicáveis.',
        ],
      },
      {
        heading: 'Ausência de transferência de propriedade',
        paragraphs: [
          'A utilização da Plataforma, a criação de uma conta, a contratação de um plano ou o processamento de conteúdos não transfere para o utilizador qualquer direito de propriedade sobre os ativos intelectuais pertencentes à Pixgo.',
          'Da mesma forma, a Pixgo não adquire automaticamente a propriedade dos conteúdos pertencentes ao utilizador apenas porque estes são submetidos aos serviços.',
          'Cada parte mantém os direitos que lhe pertençam, sujeitos às licenças, autorizações e obrigações necessárias à prestação e utilização dos serviços.',
        ],
      },
      {
        heading: 'Cumprimento da legislação',
        paragraphs: [
          'A presente política deve ser interpretada de acordo com a legislação de propriedade intelectual aplicável.',
          'Nenhuma disposição pretende limitar direitos que sejam irrenunciáveis ou que não possam ser contratualmente excluídos.',
          'Quando existam direitos ou exceções legalmente reconhecidos, estes permanecem aplicáveis nos respetivos termos.',
        ],
      },
      {
        heading: 'Alterações',
        paragraphs: [
          'A Pixgo poderá atualizar esta política para refletir alterações na Plataforma, na sua estrutura tecnológica, nas formas de distribuição, nos direitos aplicáveis ou na legislação.',
          'A versão vigente será disponibilizada na Plataforma e identificada pela respetiva data de atualização.',
        ],
      },
      {
        heading: 'Contacto',
        paragraphs: [
          'Questões, notificações ou comunicações relacionadas com direitos de autor e propriedade intelectual poderão ser enviadas através do canal oficial de suporte da Pixgo.',
        ],
        contactEmail: 'support@pixgo.qzz.io',
      },
      {
        heading: 'Versão da política',
        paragraphs: [
          'A presente Política de Direitos de Autor e Propriedade Intelectual corresponde à versão publicada pela Pixgo em agosto de 2026.',
          'A data indicada no início desta página identifica a versão atualmente vigente.',
        ],
      },
    ],
  },
  en: {
    title: 'Copyright',
    kicker: 'Intellectual property',
    subtitle: 'Ownership, exclusivity, and terms of use of Pixgo\'s intellectual property.',
    updated: 'Updated August 2026',
    sections: [
      {
        heading: 'General provisions',
        paragraphs: [
          'Ownership, protection, and terms of use of the intellectual property of the Pixgo digital platform.',
        ],
      },
      {
        heading: '1. General provisions',
        paragraphs: [
          'Pixgo respects intellectual property rights, both its own and those of third parties, and considers protecting those rights an integral part of operating the Platform.',
          'This policy sets out the rules applicable to the intellectual property related to Pixgo, including software, code, interfaces, visual identity, trademarks, content, documentation, technological structures, and other elements associated with the Platform.',
          'Using Pixgo does not transfer any intellectual property right to the user, except where expressly established or where this results directly from applicable law.',
        ],
      },
      {
        heading: '2. Ownership of the Platform',
        paragraphs: [
          'All intellectual property rights relating to the Platform belong to Pixgo or the relevant rights holders, as applicable.',
          'This includes, among others:',
        ],
        list: [
          'source code and executable code;',
          'system architecture and structure;',
          'user interfaces;',
          'design elements;',
          'visual identity;',
          'trademarks and distinctive signs;',
          'names and graphic elements;',
          'logos;',
          'icons;',
          'text and documentation;',
          'databases;',
          'information structures;',
          'features;',
          'technological components;',
          'audiovisual elements;',
          'materials made available through the Platform.',
        ],
        note: 'Where certain elements have been licensed to Pixgo by third parties, their use remains subject to the conditions and limitations established by the corresponding rights holders.',
      },
      {
        heading: '3. Reserved rights',
        paragraphs: [
          'Except where expressly authorised by Pixgo or permitted by applicable law, all rights related to the Platform remain reserved.',
          'Purchasing a subscription or using the services for free does not grant the user any ownership right over the software, code, interfaces, trademarks, design, architecture, or other components of the Platform.',
          'The user receives only a limited right to use the services in accordance with the purpose for which they were made available and with the applicable Terms and Conditions.',
        ],
      },
      {
        heading: '4. Authorised use',
        paragraphs: [
          'The user may use the Platform for the legitimate purposes for which the services are provided.',
          'Normal use of the interface, features, and results produced from content belonging to the user does not constitute an infringement of Pixgo\'s intellectual property, provided it is carried out in accordance with the Terms and Conditions.',
          'Any use exceeding the rights granted by Pixgo or by applicable law depends on the prior authorisation of the relevant rights holder.',
        ],
      },
      {
        heading: '5. Code and software',
        paragraphs: [
          'The code that makes up the Platform constitutes protected intellectual property.',
          'Except where expressly permitted by applicable law or authorised by Pixgo, the following is prohibited:',
        ],
        list: [
          'reproduction of the code;',
          'substantial or systematic copying;',
          'distribution;',
          'public disclosure;',
          'commercialisation;',
          'sublicensing;',
          'unauthorised modification;',
          'decompilation;',
          'disassembly;',
          'reverse engineering;',
          'attempting to obtain the source code;',
          'creating modified versions intended for redistribution;',
          'using the code to develop competing services.',
        ],
        note: 'The limitations set out in this article apply both to the entire code and to substantial parts of the Platform\'s implementation.',
      },
      {
        heading: '6. Design and interface',
        paragraphs: [
          'Pixgo\'s visual structure, interface organisation, graphic components, navigation elements, and visual identity constitute elements protected under applicable rights.',
          'Substantial reproduction of the Platform\'s appearance, organisation, or presentation for the purpose of creating a copy, imitation, or competing service is not permitted.',
          'The use of common functional concepts or technical standards generally used in the industry does not, by itself, constitute misappropriation of Pixgo\'s intellectual property.',
          'Protection applies to the specific protected elements, not to ideas, concepts, or features that are freely usable under applicable law.',
        ],
      },
      {
        heading: '7. Pixgo\'s trademarks and identity',
        paragraphs: [
          'The Pixgo name, its distinctive signs, logos, visual-identity elements, and other trademarks used by the Platform belong to Pixgo or are used with the authorisation of their respective owners.',
          'Using these trademarks in a way likely to create confusion as to the origin, association, sponsorship, or approval of a given product or service is prohibited.',
          'Using Pixgo\'s trademarks for commercial, promotional, or institutional purposes requires prior authorisation, except where legally permitted.',
        ],
      },
      {
        heading: '8. Content provided by Pixgo',
        paragraphs: [
          'The text, images, graphics, visual elements, documentation, informational materials, and other content provided directly by Pixgo are protected under applicable intellectual property rights.',
          'This content may not be reproduced, distributed, modified, or commercially exploited without authorisation, except where such use is expressly permitted or results from a legal provision.',
          'Normal viewing and use of this content within the Platform does not entail a transfer of ownership rights.',
        ],
      },
      {
        heading: '9. Content submitted by the user',
        paragraphs: [
          'Content sent by the user for processing remains subject to whatever intellectual property rights legally apply to it.',
          'Submitting a file, document, image, or other content to the Platform does not automatically transfer ownership of that content to Pixgo.',
          'The user is responsible for ensuring they hold the rights, authorisations, or legal grounds necessary to upload, process, modify, or use the submitted content.',
          'Pixgo does not claim ownership of the user\'s content merely by processing it through its services.',
        ],
      },
      {
        heading: '10. Content produced through the Platform',
        paragraphs: [
          'Where the Platform is used to create or transform content, ownership of the results will be determined by the nature of the content, pre-existing rights, the service conditions, and applicable law.',
          'Where the result derives from content provided by the user, using the Platform does not, by itself, transfer ownership to Pixgo.',
          'The user remains responsible for verifying that they hold all the rights necessary to use, publish, distribute, or exploit the results produced.',
        ],
      },
      {
        heading: '11. Third-party rights',
        paragraphs: [
          'Pixgo does not authorise using the Platform to infringe third parties\' intellectual property rights.',
          'The user must not submit, transform, reproduce, distribute, or make available protected content when they do not hold authorisation or another legal basis permitting such use.',
          'Where Pixgo receives a valid notice regarding an alleged intellectual property infringement, it may review the situation and adopt legally appropriate measures.',
        ],
      },
      {
        heading: '12. Distribution of the Platform',
        paragraphs: [
          'Making the Platform, its applications, components, and installation files available through official channels does not constitute general authorisation for third parties to redistribute them.',
          'Unauthorised copying, redistribution, hosting, reselling, or making available versions of the Platform may constitute an infringement of applicable rights.',
          'Pixgo may make certain versions available through different official channels, according to its technical and operational needs.',
        ],
      },
      {
        heading: '13. Applications and installable versions',
        paragraphs: [
          'Pixgo\'s applications and installable versions constitute components of the Platform and are subject to the same intellectual property rights applicable to the other components.',
          'Installing an application does not transfer any ownership right over the software to the user.',
          'Unauthorised redistribution of installation files, modified versions, or copies of the application is prohibited.',
        ],
      },
      {
        heading: '14. Reverse engineering',
        paragraphs: [
          'Except in cases where applicable law expressly permits a given activity, reverse engineering, decompiling, disassembling, or attempting to reconstruct the Platform\'s internal components is not authorised.',
          'Using methods intended to obtain source code, keys, credentials, internal mechanisms, algorithms, or protected components not made publicly available by Pixgo is likewise not permitted.',
          'Nothing in this provision is intended to restrict rights that cannot legally be excluded.',
        ],
      },
      {
        heading: '15. Creating derivative or competing services',
        paragraphs: [
          'Unauthorised use of Pixgo\'s protected elements to create, reproduce, or make available a derivative platform, application, or service is not permitted.',
          'This restriction covers the substantial copying of code, interfaces, visual identity, protected materials, proprietary components, or other elements whose reproduction is protected under applicable law.',
          'This provision does not prevent the independent development of products or services that use concepts, ideas, features, or methods not protected by exclusive rights.',
        ],
      },
      {
        heading: '16. Third-party licences',
        paragraphs: [
          'The Platform may incorporate software components, libraries, services, or other elements subject to third-party licences.',
          'The corresponding rights remain with their respective owners.',
          'Where a third-party licence grants specific rights to the user, those rights will be preserved in accordance with the terms of the relevant licence.',
          'Nothing in this policy is intended to grant Pixgo rights over components belonging to third parties.',
        ],
      },
      {
        heading: '17. Third-party materials',
        paragraphs: [
          'The Platform may display or allow access to content belonging to third parties.',
          'This content remains subject to the rights of its respective owners.',
          'Use of third-party content must comply with the conditions established by the relevant owners and with applicable law.',
          'Pixgo does not automatically grant a licence over third-party content merely by making it available or allowing it to be processed through the Platform.',
        ],
      },
      {
        heading: '18. Notices regarding infringements',
        paragraphs: [
          'Anyone who believes their intellectual property rights are being infringed through the Platform may report the situation to Pixgo through the official contact channels.',
          'Wherever possible, the notice should include sufficient information to identify:',
        ],
        list: [
          'the rights holder or authorised representative;',
          'the right allegedly infringed;',
          'the content or material in question;',
          'the location of the content or resource on the Platform;',
          'the grounds for the claim;',
          'contact information for any request for clarification.',
        ],
        note: 'Pixgo may request additional information where necessary to properly assess the notice.',
      },
      {
        heading: '19. Measures in response to alleged infringements',
        paragraphs: [
          'After receiving a notice related to intellectual property, Pixgo may review the elements presented and adopt the measures it considers appropriate under applicable law.',
          'Depending on the circumstances, measures such as restricting access, removing certain content, suspending features, or contacting the user responsible for the content may be adopted.',
          'Adopting any measure will be carried out in accordance with applicable law and does not constitute automatic acknowledgement of the validity of a claim made by a third party.',
        ],
      },
      {
        heading: '20. Abuse of reporting mechanisms',
        paragraphs: [
          'The mechanisms intended for reporting intellectual property infringements must not be used to submit false, fraudulent, or deliberately misleading claims.',
          'Abusive use of these mechanisms may give rise to legally permissible measures.',
        ],
      },
      {
        heading: '21. Protection against unauthorised copying',
        paragraphs: [
          'Pixgo may implement technical measures intended to protect the software, systems, content, and other components against unauthorised copying, access, or use.',
          'Attempting to remove, circumvent, or neutralise protection mechanisms may constitute a violation of these Terms and Conditions and of applicable intellectual property rights.',
        ],
      },
      {
        heading: '22. No transfer of ownership',
        paragraphs: [
          'Using the Platform, creating an account, contracting a plan, or processing content does not transfer to the user any ownership right over the intellectual assets belonging to Pixgo.',
          'Likewise, Pixgo does not automatically acquire ownership of content belonging to the user merely because it is submitted to the services.',
          'Each party retains the rights that belong to it, subject to the licences, authorisations, and obligations necessary to provide and use the services.',
        ],
      },
      {
        heading: '23. Compliance with the law',
        paragraphs: [
          'This policy should be interpreted in accordance with applicable intellectual property law.',
          'No provision is intended to limit rights that are non-waivable or that cannot be contractually excluded.',
          'Where legally recognised rights or exceptions exist, they remain applicable under their respective terms.',
        ],
      },
      {
        heading: '24. Changes',
        paragraphs: [
          'Pixgo may update this policy to reflect changes to the Platform, its technological structure, its distribution methods, applicable rights, or the law.',
          'The current version will be made available on the Platform and identified by its update date.',
        ],
      },
      {
        heading: '25. Contact',
        paragraphs: [
          'Questions, notices, or communications related to copyright and intellectual property may be sent through Pixgo\'s official support channel.',
        ],
        contactEmail: 'support@pixgo.qzz.io',
      },
      {
        heading: '26. Version of this policy',
        paragraphs: [
          'This Copyright and Intellectual Property Policy corresponds to the version published by Pixgo in August 2026.',
          'The date indicated at the top of this page identifies the currently effective version.',
        ],
      },
    ],
  },
  es: {
    title: 'Derechos de autor',
    kicker: 'Propiedad intelectual',
    subtitle: 'Titularidad, exclusividad y condiciones de uso de la propiedad intelectual de Pixgo.',
    updated: 'Actualizado en agosto de 2026',
    sections: [
      {
        heading: 'Disposiciones generales',
        paragraphs: [
          'Titularidad, protección y condiciones de uso de la propiedad intelectual de la plataforma digital Pixgo.',
        ],
      },
      {
        heading: '1. Disposiciones generales',
        paragraphs: [
          'Pixgo respeta los derechos de propiedad intelectual propios y de terceros y considera la protección de estos derechos parte integrante del funcionamiento de la Plataforma.',
          'La presente política establece las reglas aplicables a la propiedad intelectual relacionada con Pixgo, incluyendo software, código, interfaces, identidad visual, marcas, contenidos, documentación, estructuras tecnológicas y demás elementos asociados a la Plataforma.',
          'El uso de Pixgo no implica la transferencia de ningún derecho de propiedad intelectual al usuario, salvo que se establezca expresamente o que ello resulte directamente de la legislación aplicable.',
        ],
      },
      {
        heading: '2. Titularidad de la Plataforma',
        paragraphs: [
          'Todos los derechos de propiedad intelectual relativos a la Plataforma pertenecen a Pixgo o a los respectivos titulares de derechos, según corresponda.',
          'Se incluyen, entre otros:',
        ],
        list: [
          'código fuente y código ejecutable;',
          'arquitectura y estructura de los sistemas;',
          'interfaces de usuario;',
          'elementos de diseño;',
          'identidad visual;',
          'marcas y signos distintivos;',
          'nombres y elementos gráficos;',
          'logotipos;',
          'iconos;',
          'textos y documentación;',
          'bases de datos;',
          'estructuras de información;',
          'funcionalidades;',
          'componentes tecnológicos;',
          'elementos audiovisuales;',
          'materiales ofrecidos a través de la Plataforma.',
        ],
        note: 'Cuando determinados elementos hayan sido licenciados a Pixgo por terceros, su uso permanecerá sujeto a las condiciones y limitaciones establecidas por los respectivos titulares de los derechos.',
      },
      {
        heading: '3. Derechos reservados',
        paragraphs: [
          'Salvo autorización expresa de Pixgo o cuando lo permita la legislación aplicable, todos los derechos relacionados con la Plataforma permanecen reservados.',
          'La adquisición de una suscripción o el uso gratuito de los servicios no otorga al usuario ningún derecho de propiedad sobre el software, código, interfaces, marcas, diseño, arquitectura u otros componentes de la Plataforma.',
          'El usuario recibe únicamente el derecho limitado a utilizar los servicios de acuerdo con la finalidad para la que fueron ofrecidos y con los Términos y Condiciones aplicables.',
        ],
      },
      {
        heading: '4. Uso autorizado',
        paragraphs: [
          'El usuario podrá utilizar la Plataforma para las finalidades legítimas para las que se ofrecen los servicios.',
          'El uso normal de la interfaz, de las funcionalidades y de los resultados producidos a partir de contenidos pertenecientes al usuario no constituye una infracción de la propiedad intelectual de Pixgo, siempre que se realice de acuerdo con los Términos y Condiciones.',
          'Cualquier uso que exceda los derechos concedidos por Pixgo o por la legislación aplicable requiere la autorización previa del respectivo titular.',
        ],
      },
      {
        heading: '5. Código y software',
        paragraphs: [
          'El código que integra la Plataforma constituye propiedad intelectual protegida.',
          'Salvo que esté expresamente permitido por la legislación aplicable o autorizado por Pixgo, queda prohibido:',
        ],
        list: [
          'la reproducción del código;',
          'la copia sustancial o sistemática;',
          'la distribución;',
          'la divulgación pública;',
          'la comercialización;',
          'la sublicencia;',
          'la modificación no autorizada;',
          'la descompilación;',
          'el desensamblaje;',
          'la ingeniería inversa;',
          'el intento de obtener el código fuente;',
          'la creación de versiones modificadas destinadas a la redistribución;',
          'el uso del código para el desarrollo de servicios competidores.',
        ],
        note: 'Las limitaciones previstas en este artículo se aplican tanto al código íntegro como a partes sustanciales de la implementación de la Plataforma.',
      },
      {
        heading: '6. Diseño e interfaz',
        paragraphs: [
          'La estructura visual, la organización de la interfaz, los componentes gráficos, los elementos de navegación y la identidad visual de Pixgo constituyen elementos protegidos por los derechos aplicables.',
          'No se permite la reproducción sustancial de la apariencia, organización o presentación de la Plataforma con el objetivo de crear una copia, imitación o servicio competidor.',
          'El uso de conceptos funcionales comunes o de estándares técnicos generalmente utilizados en el sector no constituye, por sí solo, apropiación indebida de la propiedad intelectual de Pixgo.',
          'La protección recae sobre los elementos concretos protegidos y no sobre ideas, conceptos o funcionalidades de uso libre conforme a la legislación aplicable.',
        ],
      },
      {
        heading: '7. Marcas e identidad de Pixgo',
        paragraphs: [
          'El nombre Pixgo, sus signos distintivos, logotipos, elementos de identidad visual y otras marcas utilizadas por la Plataforma pertenecen a Pixgo o se utilizan con autorización de sus respectivos titulares.',
          'Queda prohibido el uso de estas marcas de forma que pueda generar confusión respecto al origen, asociación, patrocinio o aprobación de un determinado producto o servicio.',
          'El uso de las marcas de Pixgo con fines comerciales, promocionales o institucionales requiere autorización previa, salvo que esté legalmente permitido.',
        ],
      },
      {
        heading: '8. Contenidos ofrecidos por Pixgo',
        paragraphs: [
          'Los textos, imágenes, gráficos, elementos visuales, documentación, materiales informativos y demás contenidos ofrecidos directamente por Pixgo están protegidos por los derechos de propiedad intelectual aplicables.',
          'Estos contenidos no pueden reproducirse, distribuirse, modificarse ni explotarse comercialmente sin autorización, salvo que dicho uso esté expresamente permitido o resulte de una disposición legal.',
          'La consulta y el uso normal de estos contenidos en el ámbito de la Plataforma no implican la transferencia de derechos de propiedad.',
        ],
      },
      {
        heading: '9. Contenidos enviados por el usuario',
        paragraphs: [
          'Los contenidos enviados por el usuario para su procesamiento permanecen sujetos a los derechos de propiedad intelectual que legalmente les correspondan.',
          'El envío de un archivo, documento, imagen u otro contenido a la Plataforma no transfiere automáticamente la propiedad de ese contenido a Pixgo.',
          'El usuario es responsable de garantizar que dispone de los derechos, autorizaciones o fundamentos jurídicos necesarios para cargar, procesar, modificar o utilizar los contenidos enviados.',
          'Pixgo no reivindica la propiedad de los contenidos del usuario por el simple hecho de procesarlos a través de sus servicios.',
        ],
      },
      {
        heading: '10. Contenidos producidos a través de la Plataforma',
        paragraphs: [
          'Cuando la Plataforma se utilice para crear o transformar contenidos, la titularidad de los resultados se determinará según la naturaleza del contenido, los derechos preexistentes, las condiciones del servicio y la legislación aplicable.',
          'Cuando el resultado derive de contenido proporcionado por el usuario, el uso de la Plataforma no implica, por sí solo, la transferencia de la propiedad a Pixgo.',
          'El usuario sigue siendo responsable de verificar si dispone de todos los derechos necesarios para utilizar, publicar, distribuir o explotar los resultados producidos.',
        ],
      },
      {
        heading: '11. Derechos de terceros',
        paragraphs: [
          'Pixgo no autoriza el uso de la Plataforma para infringir derechos de propiedad intelectual de terceros.',
          'El usuario no deberá enviar, transformar, reproducir, distribuir o poner a disposición contenidos protegidos cuando no disponga de autorización u otro fundamento jurídico que permita dicho uso.',
          'Si Pixgo recibe una comunicación válida relativa a una presunta infracción de derechos de propiedad intelectual, podrá analizar la situación y adoptar las medidas legalmente adecuadas.',
        ],
      },
      {
        heading: '12. Distribución de la Plataforma',
        paragraphs: [
          'La puesta a disposición de la Plataforma, de sus aplicaciones, componentes y archivos de instalación a través de canales oficiales no constituye una autorización general para que terceros los redistribuyan.',
          'La copia, redistribución, alojamiento, reventa o puesta a disposición no autorizada de versiones de la Plataforma podrá constituir una infracción de los derechos aplicables.',
          'Pixgo podrá poner a disposición determinadas versiones a través de diferentes canales oficiales, de acuerdo con sus necesidades técnicas y operativas.',
        ],
      },
      {
        heading: '13. Aplicaciones y versiones instalables',
        paragraphs: [
          'Las aplicaciones y versiones instalables de Pixgo constituyen componentes de la Plataforma y están sujetas a los mismos derechos de propiedad intelectual aplicables a los demás componentes.',
          'La instalación de una aplicación no transfiere al usuario ningún derecho de propiedad sobre el software.',
          'Queda prohibida la redistribución no autorizada de archivos de instalación, versiones modificadas o copias de la aplicación.',
        ],
      },
      {
        heading: '14. Ingeniería inversa',
        paragraphs: [
          'Salvo en los casos en que la legislación aplicable permita expresamente una determinada actividad, no está autorizada la realización de ingeniería inversa, descompilación, desensamblaje o el intento de reconstruir los componentes internos de la Plataforma.',
          'Tampoco está permitido utilizar métodos destinados a obtener código fuente, claves, credenciales, mecanismos internos, algoritmos o componentes protegidos que no sean puestos a disposición pública por Pixgo.',
          'Nada en esta disposición pretende restringir derechos que no puedan ser legalmente excluidos.',
        ],
      },
      {
        heading: '15. Creación de servicios derivados o competidores',
        paragraphs: [
          'No se permite el uso no autorizado de elementos protegidos de Pixgo para crear, reproducir o poner a disposición una plataforma, aplicación o servicio derivado.',
          'Esta restricción abarca la copia sustancial de código, interfaces, identidad visual, materiales protegidos, componentes propietarios u otros elementos cuya reproducción esté protegida por la legislación aplicable.',
          'La presente disposición no impide el desarrollo independiente de productos o servicios que utilicen conceptos, ideas, funcionalidades o métodos que no estén protegidos por derechos exclusivos.',
        ],
      },
      {
        heading: '16. Licencias de terceros',
        paragraphs: [
          'La Plataforma podrá incorporar componentes de software, bibliotecas, servicios u otros elementos sujetos a licencias de terceros.',
          'Los respectivos derechos permanecen en poder de sus titulares correspondientes.',
          'Cuando una licencia de terceros conceda derechos específicos al usuario, dichos derechos se preservarán de acuerdo con los términos de la respectiva licencia.',
          'Ninguna disposición de esta política pretende atribuir a Pixgo derechos sobre componentes pertenecientes a terceros.',
        ],
      },
      {
        heading: '17. Materiales de terceros',
        paragraphs: [
          'La Plataforma podrá presentar o permitir el acceso a contenidos pertenecientes a terceros.',
          'Estos contenidos permanecen sujetos a los derechos de sus respectivos titulares.',
          'El uso de contenidos de terceros deberá respetar las condiciones establecidas por sus respectivos titulares y la legislación aplicable.',
          'Pixgo no concede automáticamente una licencia sobre contenidos de terceros por el simple hecho de ponerlos a disposición o permitir su procesamiento a través de la Plataforma.',
        ],
      },
      {
        heading: '18. Comunicaciones relativas a infracciones',
        paragraphs: [
          'Cualquier persona que considere que sus derechos de propiedad intelectual están siendo infringidos a través de la Plataforma podrá comunicar la situación a Pixgo a través de los canales oficiales de contacto.',
          'La comunicación deberá, siempre que sea posible, incluir información suficiente para identificar:',
        ],
        list: [
          'al titular o representante autorizado;',
          'el derecho presuntamente infringido;',
          'el contenido o material en cuestión;',
          'la ubicación del contenido o recurso en la Plataforma;',
          'los fundamentos de la reclamación;',
          'información de contacto para una eventual solicitud de aclaración.',
        ],
        note: 'Pixgo podrá solicitar información adicional cuando sea necesaria para evaluar adecuadamente la comunicación.',
      },
      {
        heading: '19. Medidas ante presuntas infracciones',
        paragraphs: [
          'Tras recibir una comunicación relacionada con propiedad intelectual, Pixgo podrá analizar los elementos presentados y adoptar las medidas que considere adecuadas conforme a la legislación aplicable.',
          'Según las circunstancias, podrán adoptarse medidas como la restricción del acceso, la eliminación de determinado contenido, la suspensión de funcionalidades o el contacto con el usuario responsable del contenido.',
          'La adopción de cualquier medida se realizará de acuerdo con la legislación aplicable y no constituye un reconocimiento automático de la validez de una alegación presentada por terceros.',
        ],
      },
      {
        heading: '20. Abuso de los mecanismos de denuncia',
        paragraphs: [
          'Los mecanismos destinados a la comunicación de infracciones de propiedad intelectual no deben utilizarse para presentar alegaciones falsas, fraudulentas o deliberadamente engañosas.',
          'El uso abusivo de estos mecanismos podrá dar lugar a medidas legalmente admisibles.',
        ],
      },
      {
        heading: '21. Protección contra la copia no autorizada',
        paragraphs: [
          'Pixgo podrá implementar medidas técnicas destinadas a proteger el software, los sistemas, los contenidos y otros componentes contra la copia, el acceso o el uso no autorizados.',
          'El intento de eliminar, eludir o neutralizar mecanismos de protección podrá constituir una infracción de estos Términos y Condiciones y de los derechos de propiedad intelectual aplicables.',
        ],
      },
      {
        heading: '22. Ausencia de transferencia de propiedad',
        paragraphs: [
          'El uso de la Plataforma, la creación de una cuenta, la contratación de un plan o el procesamiento de contenidos no transfiere al usuario ningún derecho de propiedad sobre los activos intelectuales pertenecientes a Pixgo.',
          'Del mismo modo, Pixgo no adquiere automáticamente la propiedad de los contenidos pertenecientes al usuario por el simple hecho de que estos se envíen a los servicios.',
          'Cada parte conserva los derechos que le correspondan, sujetos a las licencias, autorizaciones y obligaciones necesarias para la prestación y el uso de los servicios.',
        ],
      },
      {
        heading: '23. Cumplimiento de la legislación',
        paragraphs: [
          'La presente política debe interpretarse de acuerdo con la legislación de propiedad intelectual aplicable.',
          'Ninguna disposición pretende limitar derechos irrenunciables o que no puedan excluirse contractualmente.',
          'Cuando existan derechos o excepciones legalmente reconocidos, estos seguirán siendo aplicables en sus respectivos términos.',
        ],
      },
      {
        heading: '24. Cambios',
        paragraphs: [
          'Pixgo podrá actualizar esta política para reflejar cambios en la Plataforma, en su estructura tecnológica, en las formas de distribución, en los derechos aplicables o en la legislación.',
          'La versión vigente se pondrá a disposición en la Plataforma e identificada por su fecha de actualización.',
        ],
      },
      {
        heading: '25. Contacto',
        paragraphs: [
          'Las preguntas, notificaciones o comunicaciones relacionadas con derechos de autor y propiedad intelectual podrán enviarse a través del canal oficial de soporte de Pixgo.',
        ],
        contactEmail: 'support@pixgo.qzz.io',
      },
      {
        heading: '26. Versión de la política',
        paragraphs: [
          'La presente Política de Derechos de Autor y Propiedad Intelectual corresponde a la versión publicada por Pixgo en agosto de 2026.',
          'La fecha indicada al inicio de esta página identifica la versión actualmente vigente.',
        ],
      },
    ],
  },
};

export default function CopyrightPage() {
  const lang = useLegalLang();
  return <LegalLayout content={CONTENT[lang]} icon={<CopyrightOutlinedIcon style={{ fontSize: 26, color: 'var(--color-primary)' }} />} />;
}
