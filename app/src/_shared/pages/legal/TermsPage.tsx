'use client';
import React from 'react';
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined';
import LegalLayout, { LegalContent } from '../../components/legal/LegalLayout';
import { useLegalLang, LegalLang } from '../../lib/legalLang';

const CONTENT: Record<LegalLang, LegalContent> = {
  pt: {
    title: 'Termos e condições',
    kicker: 'Documento legal',
    subtitle: 'Condições de utilização da plataforma Pixgo e das suas ferramentas.',
    updated: 'Atualizado em agosto de 2026',
    sections: [
      {
        heading: 'Âmbito geral',
        paragraphs: [
          'Condições gerais de acesso e utilização da plataforma digital Pixgo.',
        ],
      },
      {
        heading: 'Objeto e âmbito de aplicação',
        paragraphs: [
          'Os presentes Termos e Condições regulam o acesso, registo e utilização da plataforma digital Pixgo, incluindo os respetivos serviços, funcionalidades, sistemas, interfaces e recursos disponibilizados aos utilizadores.',
          'A Pixgo constitui uma plataforma digital destinada à disponibilização de serviços tecnológicos para produtividade, processamento, transformação, criação e gestão de conteúdos digitais.',
          'Ao criar uma conta, aceder à Plataforma, contratar um plano ou utilizar qualquer serviço disponibilizado pela Pixgo, o utilizador declara que leu, compreendeu e aceita os presentes Termos e Condições, bem como as demais políticas e documentos legais aplicáveis.',
          'Caso o utilizador não concorde com qualquer disposição destes Termos e Condições, deverá cessar a utilização da Plataforma.',
        ],
      },
      {
        heading: 'Elegibilidade e capacidade para utilização',
        paragraphs: [
          'A utilização da Pixgo está sujeita à legislação aplicável ao utilizador e ao território a partir do qual os serviços são utilizados.',
          'O utilizador declara possuir capacidade legal para aceitar estes Termos e Condições e para assumir as obrigações deles decorrentes.',
          'Quando a utilização da Plataforma estiver sujeita a requisitos específicos de idade, autorização, representação ou capacidade jurídica, deverão ser observadas as exigências estabelecidas pela legislação aplicável.',
          'A Pixgo poderá restringir ou impedir o acesso quando existam razões legais, técnicas ou de segurança que justifiquem essa medida.',
        ],
      },
      {
        heading: 'Registo e criação de conta',
        paragraphs: [
          'Determinadas funcionalidades da Pixgo poderão exigir a criação de uma conta de utilizador.',
          'No momento do registo, o utilizador deverá fornecer informações verdadeiras, completas e atualizadas, assumindo responsabilidade pela exatidão dos dados fornecidos.',
          'O utilizador é responsável por manter os dados da conta atualizados e por comunicar qualquer alteração relevante.',
          'As credenciais de acesso são pessoais e devem ser mantidas sob confidencialidade. O utilizador é responsável pelas atividades realizadas através da sua conta, salvo quando demonstre que estas ocorreram sem a sua autorização e por circunstâncias que não lhe sejam imputáveis.',
          'A Pixgo poderá solicitar procedimentos adicionais de verificação ou segurança sempre que tal seja necessário para proteger a conta, a Plataforma ou os seus utilizadores.',
        ],
      },
      {
        heading: 'Segurança da conta',
        paragraphs: [
          'O utilizador deve adotar medidas razoáveis para impedir o acesso não autorizado à sua conta.',
          'É proibida a partilha, cedência, comercialização ou transferência de credenciais quando tal seja incompatível com as condições do serviço.',
          'Em caso de suspeita de comprometimento da conta, utilização não autorizada ou divulgação das credenciais, o utilizador deverá comunicar a situação à Pixgo através dos canais oficiais de suporte.',
          'A Pixgo poderá suspender temporariamente uma conta quando existam indícios razoáveis de comprometimento de segurança, fraude, abuso ou utilização incompatível com estes Termos e Condições.',
        ],
      },
      {
        heading: 'Serviços disponibilizados',
        paragraphs: [
          'A Pixgo disponibiliza serviços digitais destinados ao processamento, transformação, criação, organização e gestão de conteúdos digitais.',
          'As funcionalidades disponíveis podem variar de acordo com o plano contratado, requisitos técnicos, capacidade operacional, atualizações da Plataforma e demais condições aplicáveis.',
          'A Pixgo poderá adicionar, alterar, aperfeiçoar, limitar, substituir, suspender ou remover funcionalidades, desde que respeitados os direitos legalmente adquiridos pelos utilizadores e as obrigações contratuais aplicáveis.',
          'A disponibilidade de determinada funcionalidade em determinado momento não constitui garantia de que a mesma permanecerá permanentemente inalterada.',
        ],
      },
      {
        heading: 'Utilização dos serviços',
        paragraphs: [
          'Os serviços devem ser utilizados exclusivamente para finalidades legítimas e de acordo com a legislação aplicável.',
          'O utilizador é responsável pelos ficheiros, documentos, imagens, informações e demais conteúdos que introduza, processe, carregue, transmita ou gere através da Plataforma.',
          'O utilizador declara e garante que possui os direitos, autorizações ou bases jurídicas necessárias para utilizar e processar os conteúdos submetidos.',
          'A Pixgo não concede ao utilizador qualquer autorização para utilizar conteúdos pertencentes a terceiros quando essa utilização não seja legalmente permitida.',
        ],
      },
      {
        heading: 'Conteúdos do utilizador',
        paragraphs: [
          'Os conteúdos submetidos pelo utilizador permanecem sujeitos aos direitos de propriedade que legalmente lhes sejam aplicáveis.',
          'A utilização da Plataforma não implica, por si só, transferência de propriedade dos conteúdos do utilizador para a Pixgo.',
          'Para permitir a execução dos serviços solicitados, o utilizador concede à Pixgo apenas as autorizações técnicas necessárias para receber, processar, armazenar temporariamente, transmitir ou disponibilizar os conteúdos no âmbito da funcionalidade utilizada.',
          'Essas autorizações são limitadas à finalidade de prestação dos serviços e não conferem à Pixgo um direito geral de exploração comercial dos conteúdos do utilizador.',
          'O utilizador permanece responsável pela legalidade dos conteúdos submetidos e pela existência dos direitos necessários à sua utilização.',
        ],
      },
      {
        heading: 'Conteúdos proibidos',
        paragraphs: [
          'É proibida a utilização da Plataforma para armazenar, processar, transmitir ou disponibilizar conteúdos cuja utilização seja ilegal ou que viole direitos de terceiros.',
          'É igualmente proibida a utilização dos serviços para atividades fraudulentas, abusivas, enganosas, maliciosas ou destinadas a comprometer o funcionamento ou a segurança da Plataforma.',
          'Quando a Pixgo tome conhecimento de uma utilização manifestamente ilícita ou incompatível com estes Termos e Condições, poderá adotar as medidas tecnicamente e legalmente permitidas, incluindo restrição de acesso, remoção de conteúdos quando aplicável, suspensão de funcionalidades ou encerramento de contas.',
          'Quando necessário, determinadas informações poderão ser preservadas ou divulgadas para cumprimento de obrigações legais ou de determinações emitidas por autoridades competentes.',
        ],
      },
      {
        heading: 'Utilização aceitável da Plataforma',
        paragraphs: [
          'É expressamente proibido:',
        ],
        list: [
          'tentar obter acesso não autorizado a contas, sistemas, servidores, bases de dados ou áreas restritas da Pixgo;',
          'explorar vulnerabilidades, falhas ou mecanismos de segurança da Plataforma;',
          'contornar mecanismos de autenticação, controlo de acesso, limites técnicos ou restrições associadas aos planos;',
          'utilizar métodos destinados a interferir com a disponibilidade, estabilidade ou integridade da Plataforma;',
          'executar atividades automatizadas abusivas que provoquem carga excessiva ou utilização incompatível com a finalidade normal dos serviços;',
          'utilizar bots, scripts, crawlers, scrapers ou mecanismos semelhantes para explorar os serviços sem autorização;',
          'tentar obter funcionalidades, recursos ou benefícios sem cumprir as condições aplicáveis;',
          'utilizar identidades falsas ou informações fraudulentas para obter acesso aos serviços;',
          'utilizar a Plataforma para atividades que possam causar prejuízo a outros utilizadores ou terceiros;',
          'realizar engenharia reversa, descompilação ou desmontagem dos componentes da Plataforma, salvo quando expressamente permitido pela legislação aplicável;',
          'reproduzir, copiar, revender ou disponibilizar comercialmente os serviços da Pixgo sem autorização.',
        ],
        note: 'A violação destas disposições poderá resultar na aplicação de medidas de segurança e administrativas, incluindo limitação, suspensão ou encerramento da conta, sem prejuízo de outras medidas legalmente admissíveis.',
      },
      {
        heading: 'Planos gratuitos',
        paragraphs: [
          'A Pixgo poderá disponibilizar uma modalidade de utilização gratuita.',
          'O plano gratuito poderá estar sujeito a limites de utilização, restrições funcionais, publicidade, limites de processamento, capacidade ou outras condições apresentadas na Plataforma.',
          'A Pixgo poderá alterar as condições do plano gratuito, desde que respeitados os direitos legalmente aplicáveis.',
          'A disponibilização gratuita de determinados serviços não cria uma obrigação de manutenção indefinida desses serviços sem alterações.',
        ],
      },
      {
        heading: 'Planos pagos',
        paragraphs: [
          'A Pixgo poderá disponibilizar planos sujeitos a pagamento, com diferentes funcionalidades, limites, períodos de utilização e condições comerciais.',
          'As características de cada plano serão apresentadas antes da contratação.',
          'A contratação de um plano pago concede ao utilizador o direito de utilizar os serviços incluídos durante o período contratado, de acordo com as condições vigentes no momento da contratação e com estes Termos e Condições.',
          'O acesso a funcionalidades específicas poderá estar sujeito a limites técnicos ou de utilização expressamente apresentados na Plataforma.',
        ],
      },
      {
        heading: 'Preços e pagamentos',
        paragraphs: [
          'Os preços aplicáveis aos serviços pagos são os apresentados pela Pixgo no momento da contratação.',
          'Os pagamentos poderão ser processados por prestadores de serviços de pagamento externos, de acordo com os respetivos termos e políticas.',
          'A Pixgo poderá alterar os preços dos planos para futuras contratações ou períodos de renovação, respeitando os direitos dos consumidores e as obrigações legais aplicáveis.',
          'O utilizador é responsável por fornecer informações de pagamento válidas e por garantir que possui autorização para utilizar o método de pagamento selecionado.',
          'A Pixgo não é responsável por falhas de processamento diretamente imputáveis ao prestador externo de pagamento, sem prejuízo dos direitos legalmente conferidos ao utilizador perante a Pixgo.',
        ],
      },
      {
        heading: 'Subscrições e renovação',
        paragraphs: [
          'Quando um plano for disponibilizado como subscrição, o serviço poderá renovar-se automaticamente de acordo com a periodicidade selecionada no momento da contratação.',
          'O utilizador poderá cancelar a renovação através dos mecanismos disponibilizados na área de conta ou por outro método indicado pela Plataforma.',
          'O cancelamento de uma subscrição não implica necessariamente a interrupção imediata do acesso aos serviços pagos. Salvo disposição legal ou contratual em contrário, o acesso permanecerá disponível até ao final do período já pago.',
          'Após o término do período contratado, o acesso às funcionalidades exclusivas do plano pago poderá ser encerrado ou convertido para uma modalidade gratuita, quando disponível.',
        ],
      },
      {
        heading: 'Cancelamento e reembolsos',
        paragraphs: [
          'Os pedidos de cancelamento, reembolso ou resolução serão tratados de acordo com as condições apresentadas no momento da contratação e com a legislação aplicável.',
          'O cancelamento de uma subscrição futura não implica, por si só, o reembolso automático de períodos já utilizados.',
          'Os direitos legais dos consumidores, incluindo eventuais direitos de resolução, arrependimento ou reembolso obrigatórios por lei, permanecem integralmente preservados.',
          'Quando um reembolso seja devido, o processamento poderá depender do método de pagamento utilizado e dos procedimentos do respetivo prestador.',
        ],
      },
      {
        heading: 'Garantia e conformidade do serviço',
        paragraphs: [
          'A Pixgo procura disponibilizar os serviços de acordo com as características apresentadas no momento da contratação.',
          'Os serviços digitais podem apresentar erros, indisponibilidades temporárias, limitações técnicas ou incompatibilidades decorrentes de fatores internos ou externos.',
          'Quando uma falha relevante impedir a utilização normal de uma funcionalidade incluída num plano pago, o utilizador poderá comunicar o problema ao suporte.',
          'A Pixgo procurará corrigir falhas técnicas dentro de um prazo razoável, considerando a natureza e complexidade do problema.',
          'Quando aplicável e exigido pela legislação de proteção do consumidor, poderão ser disponibilizadas medidas corretivas, extensão do período contratado, redução proporcional do preço, reembolso ou outras soluções legalmente previstas.',
        ],
      },
      {
        heading: 'Disponibilidade e manutenção',
        paragraphs: [
          'A Pixgo procura manter a Plataforma disponível de forma contínua e assegurar níveis adequados de desempenho, estabilidade e segurança.',
          'Contudo, não é possível garantir disponibilidade ininterrupta ou ausência absoluta de falhas.',
          'A Plataforma poderá sofrer interrupções devido a manutenção, atualizações, falhas de infraestrutura, problemas de conectividade, incidentes de segurança, indisponibilidade de fornecedores, alterações técnicas, acontecimentos de força maior ou outras circunstâncias fora do controlo razoável da Pixgo.',
          'Sempre que possível, intervenções programadas que possam afetar significativamente a utilização serão comunicadas através dos canais disponíveis.',
          'A existência de períodos de indisponibilidade não constitui, por si só, incumprimento contratual quando resultem de circunstâncias justificadas e sejam tratadas de acordo com a legislação aplicável.',
        ],
      },
      {
        heading: 'Suporte',
        paragraphs: [
          'A Pixgo disponibiliza canais oficiais de suporte destinados ao esclarecimento de dúvidas, comunicação de problemas técnicos e assistência relacionada com a utilização da Plataforma.',
          'O suporte poderá ser prestado de acordo com a disponibilidade operacional da equipa responsável e com as condições aplicáveis a cada modalidade de serviço.',
          'Os pedidos relacionados com indisponibilidade, segurança, pagamentos ou impossibilidade de acesso poderão receber tratamento prioritário conforme a sua natureza.',
          'A apresentação de um pedido de suporte não garante uma resolução imediata, especialmente quando o problema dependa de terceiros ou de circunstâncias técnicas complexas.',
        ],
      },
      {
        heading: 'Propriedade intelectual da Pixgo',
        paragraphs: [
          'Todos os direitos de propriedade intelectual relacionados com a Plataforma e os seus componentes pertencem à Pixgo ou aos respetivos titulares licenciantes, conforme aplicável.',
          'Estão abrangidos, entre outros, o software, código, arquitetura, interfaces, elementos gráficos, identidade visual, marcas, nomes comerciais, textos, documentação, bases de dados, estruturas, funcionalidades e conteúdos próprios.',
          'A utilização da Plataforma não concede ao utilizador qualquer licença ou direito de propriedade além daquele estritamente necessário para utilizar os serviços de acordo com estes Termos e Condições.',
          'É proibida a reprodução, distribuição, exploração comercial, disponibilização pública ou modificação não autorizada de elementos protegidos da Plataforma.',
        ],
      },
      {
        heading: 'Direitos sobre resultados gerados',
        paragraphs: [
          'Quando os serviços produzirem ficheiros, documentos ou outros resultados a partir de conteúdos fornecidos pelo utilizador, os direitos sobre esses resultados serão determinados de acordo com a natureza do conteúdo, os direitos preexistentes e a legislação aplicável.',
          'A utilização da Plataforma não transfere automaticamente para a Pixgo direitos de propriedade sobre resultados pertencentes ao utilizador.',
          'O utilizador é responsável por verificar se a utilização, publicação, distribuição ou exploração dos resultados produzidos é permitida pelas leis aplicáveis e pelos direitos de terceiros.',
        ],
      },
      {
        heading: 'Serviços e componentes de terceiros',
        paragraphs: [
          'A Plataforma poderá depender de serviços, infraestruturas, tecnologias ou componentes fornecidos por terceiros.',
          'A utilização desses componentes poderá estar sujeita a condições adicionais estabelecidas pelos respetivos fornecedores.',
          'A Pixgo procurará selecionar e operar esses serviços de forma adequada, mas não controla integralmente a disponibilidade, alterações ou políticas de terceiros.',
          'Interrupções ou alterações provocadas por fornecedores externos poderão afetar determinadas funcionalidades da Plataforma.',
        ],
      },
      {
        heading: 'Privacidade e proteção de dados',
        paragraphs: [
          'O tratamento de dados pessoais realizado no âmbito da utilização da Pixgo é regulado pela Política de Privacidade da Plataforma.',
          'O utilizador deverá consultar essa política para conhecer as categorias de dados tratadas, finalidades, fundamentos jurídicos, períodos de conservação, direitos dos titulares e demais informações relevantes.',
          'A Pixgo compromete-se a tratar os dados pessoais de acordo com a legislação aplicável e com as suas políticas publicadas.',
        ],
      },
      {
        heading: 'Publicidade',
        paragraphs: [
          'A Pixgo poderá apresentar publicidade em determinadas modalidades de utilização.',
          'A publicidade poderá ser disponibilizada por entidades terceiras e poderá variar conforme fatores técnicos, contexto, disponibilidade e configuração do serviço.',
          'A apresentação de publicidade não significa que a Pixgo recomende, garanta ou assuma responsabilidade pelos produtos ou serviços anunciados por terceiros.',
          'As condições relativas à publicidade poderão variar de acordo com o plano contratado.',
        ],
      },
      {
        heading: 'Limitação de responsabilidade',
        paragraphs: [
          'Na máxima extensão permitida pela legislação aplicável, a Pixgo não será responsável por danos resultantes de utilização inadequada da Plataforma, utilização contrária aos presentes Termos e Condições, falhas provocadas por terceiros ou acontecimentos que não possam ser razoavelmente controlados pela Pixgo.',
          'A Pixgo não garante que os resultados obtidos através dos serviços sejam adequados a uma finalidade específica, completos, exatos ou juridicamente suficientes para qualquer utilização particular, salvo quando expressamente estabelecido.',
          'O utilizador deve avaliar e verificar os resultados produzidos antes de os utilizar em situações relevantes.',
          'Quando os conteúdos processados sejam importantes, o utilizador deve manter cópias de segurança independentes.',
          'Nada nestes Termos e Condições exclui ou limita responsabilidades que não possam legalmente ser excluídas ou limitadas.',
        ],
      },
      {
        heading: 'Perda de dados',
        paragraphs: [
          'Embora a Pixgo adote medidas destinadas a preservar a integridade dos serviços, não pode garantir que qualquer conteúdo submetido à Plataforma permanecerá disponível de forma permanente.',
          'Ficheiros ou outros conteúdos poderão ser sujeitos a processamento temporário, eliminação automática, limitações de armazenamento ou outras condições técnicas.',
          'O utilizador é responsável por manter cópias de segurança dos conteúdos cuja preservação seja importante.',
          'A Pixgo não deve ser utilizada como único mecanismo de armazenamento permanente de conteúdos essenciais, salvo quando expressamente disponibilizado e contratado um serviço com essa finalidade.',
        ],
      },
      {
        heading: 'Suspensão e encerramento da conta',
        paragraphs: [
          'A Pixgo poderá suspender, limitar ou encerrar uma conta quando existam fundamentos relacionados com violação destes Termos e Condições, fraude, abuso, riscos de segurança, utilização ilícita, incumprimento de obrigações financeiras ou exigências legais.',
          'Sempre que legalmente possível e razoável, a Pixgo poderá comunicar ao utilizador a medida adotada e respetivo fundamento.',
          'Em situações de risco imediato para a segurança da Plataforma, dos utilizadores ou de terceiros, a suspensão poderá ocorrer sem aviso prévio.',
          'O utilizador poderá solicitar o encerramento da sua conta através dos mecanismos disponibilizados pela Plataforma.',
          'O encerramento da conta não elimina obrigações que, pela sua natureza, devam permanecer em vigor após o término da utilização.',
        ],
      },
      {
        heading: 'Alterações da Plataforma',
        paragraphs: [
          'A Pixgo poderá modificar a estrutura, aparência, arquitetura, funcionalidades, requisitos técnicos e condições operacionais da Plataforma.',
          'Essas alterações poderão ser realizadas para melhorar desempenho, segurança, compatibilidade, experiência de utilização, conformidade legal ou sustentabilidade operacional.',
          'Quando uma alteração afetar materialmente um serviço pago durante um período contratado, serão respeitados os direitos legalmente aplicáveis ao utilizador.',
        ],
      },
      {
        heading: 'Alterações aos Termos e Condições',
        paragraphs: [
          'A Pixgo poderá atualizar estes Termos e Condições para refletir alterações nos serviços, na legislação, nos processos operacionais ou nos requisitos de segurança.',
          'A versão atualizada será disponibilizada na Plataforma e identificada pela respetiva data de atualização.',
          'Quando a legislação aplicável exigir comunicação específica ou aceitação expressa de determinadas alterações, serão adotados os procedimentos correspondentes.',
          'A continuação da utilização da Plataforma após a entrada em vigor de alterações constitui aceitação dos novos Termos e Condições na medida permitida pela legislação aplicável.',
        ],
      },
      {
        heading: 'Comunicações eletrónicas',
        paragraphs: [
          'O utilizador aceita receber comunicações relacionadas com a operação da conta, segurança, pagamentos, alterações relevantes dos serviços, manutenção e outras matérias necessárias à prestação da Plataforma através dos meios de comunicação associados à conta.',
          'Comunicações de natureza comercial serão realizadas de acordo com as preferências do utilizador e com a legislação aplicável.',
          'O utilizador deve manter os seus dados de contacto atualizados para assegurar a receção de comunicações importantes.',
        ],
      },
      {
        heading: 'Cumprimento da legislação',
        paragraphs: [
          'A utilização da Pixgo está sujeita à legislação aplicável.',
          'O utilizador compromete-se a utilizar a Plataforma em conformidade com todas as normas que lhe sejam aplicáveis, incluindo normas relativas a propriedade intelectual, proteção de dados, segurança informática, conteúdos digitais, direitos de terceiros e utilização de serviços eletrónicos.',
          'A Pixgo poderá cooperar com autoridades competentes quando tal seja legalmente exigido.',
        ],
      },
      {
        heading: 'Força maior',
        paragraphs: [
          'A Pixgo não será considerada responsável por atrasos ou impossibilidade de cumprimento de determinadas obrigações quando estes resultem de acontecimentos fora do seu controlo razoável.',
          'Podem constituir situações dessa natureza, entre outras, desastres naturais, conflitos, atos de autoridades, interrupções generalizadas de telecomunicações, falhas críticas de infraestrutura, ataques informáticos de grande escala, indisponibilidade de fornecedores essenciais ou outras circunstâncias extraordinárias.',
          'A Pixgo procurará adotar medidas razoáveis para reduzir os efeitos dessas situações e restabelecer os serviços assim que seja possível.',
        ],
      },
      {
        heading: 'Independência das disposições',
        paragraphs: [
          'Caso qualquer disposição destes Termos e Condições seja considerada inválida, ilegal ou inexequível por autoridade competente, essa disposição será aplicada na máxima extensão permitida pela legislação aplicável.',
          'A eventual invalidade de uma disposição não afetará a validade das restantes disposições.',
        ],
      },
      {
        heading: 'Não renúncia',
        paragraphs: [
          'A ausência de exercício imediato de qualquer direito previsto nestes Termos e Condições não constitui renúncia a esse direito.',
          'Qualquer renúncia deverá ser interpretada de forma restritiva e não impedirá o exercício posterior de direitos semelhantes, salvo disposição legal ou contratual em contrário.',
        ],
      },
      {
        heading: 'Relação entre o utilizador e a Pixgo',
        paragraphs: [
          'A utilização da Plataforma não cria, por si só, qualquer relação de sociedade, representação, mandato, agência, emprego ou associação entre o utilizador e a Pixgo.',
          'O utilizador não poderá apresentar-se perante terceiros como representante ou agente autorizado da Pixgo sem autorização expressa.',
        ],
      },
      {
        heading: 'Lei aplicável e resolução de litígios',
        paragraphs: [
          'Os presentes Termos e Condições serão interpretados de acordo com a legislação aplicável à relação entre a Pixgo e o utilizador.',
          'Sempre que exista legislação de proteção do consumidor aplicável, nenhuma disposição destes Termos e Condições pretende excluir ou restringir direitos imperativos conferidos ao consumidor.',
          'As partes procurarão, sempre que possível, resolver de forma amigável quaisquer divergências relacionadas com a utilização da Plataforma.',
          'Sem prejuízo dos direitos legalmente atribuídos ao utilizador, os litígios serão submetidos às autoridades ou tribunais competentes nos termos da legislação aplicável.',
        ],
      },
      {
        heading: 'Contacto',
        paragraphs: [
          'Questões relacionadas com estes Termos e Condições, utilização da Plataforma, pagamentos, segurança ou suporte poderão ser apresentadas através dos canais oficiais de contacto disponibilizados pela Pixgo.',
        ],
        contactEmail: 'support@pixgo.qzz.io',
      },
      {
        heading: 'Versão dos Termos',
        paragraphs: [
          'Os presentes Termos e Condições correspondem à versão disponibilizada pela Pixgo em agosto de 2026.',
          'A data indicada no início desta página identifica a versão atualmente publicada.',
          'A utilização da Plataforma após a entrada em vigor de uma nova versão estará sujeita aos Termos e Condições então vigentes, respeitados os direitos legalmente aplicáveis aos utilizadores.',
        ],
      },
    ],
  },
  en: {
    title: 'Terms and Conditions',
    kicker: 'Legal document',
    subtitle: 'Terms of use for the Pixgo platform and its tools.',
    updated: 'Updated August 2026',
    sections: [
      {
        heading: 'General scope',
        paragraphs: [
          'General conditions for accessing and using the Pixgo digital platform.',
        ],
      },
      {
        heading: '1. Purpose and scope',
        paragraphs: [
          'These Terms and Conditions govern access to, registration for, and use of the Pixgo digital platform, including its services, features, systems, interfaces, and resources made available to users.',
          'Pixgo is a digital platform for providing technology services for productivity, processing, transformation, creation, and management of digital content.',
          'By creating an account, accessing the Platform, contracting a plan, or using any service provided by Pixgo, the user declares that they have read, understood, and accepted these Terms and Conditions, as well as the other applicable policies and legal documents.',
          'If the user does not agree with any provision of these Terms and Conditions, they must stop using the Platform.',
        ],
      },
      {
        heading: '2. Eligibility and capacity to use the service',
        paragraphs: [
          'Use of Pixgo is subject to the legislation applicable to the user and to the territory from which the services are used.',
          'The user declares that they have the legal capacity to accept these Terms and Conditions and to assume the obligations arising from them.',
          'Where use of the Platform is subject to specific age, authorisation, representation, or legal-capacity requirements, the requirements established by applicable law must be observed.',
          'Pixgo may restrict or prevent access where there are legal, technical, or security reasons that justify such a measure.',
        ],
      },
      {
        heading: '3. Registration and account creation',
        paragraphs: [
          'Certain features of Pixgo may require creating a user account.',
          'At the time of registration, the user must provide truthful, complete, and up-to-date information, and takes responsibility for the accuracy of the data provided.',
          'The user is responsible for keeping their account data up to date and for reporting any relevant change.',
          'Access credentials are personal and must be kept confidential. The user is responsible for activities carried out through their account, except where they demonstrate that these occurred without their authorisation and due to circumstances not attributable to them.',
          'Pixgo may request additional verification or security procedures whenever necessary to protect the account, the Platform, or its users.',
        ],
      },
      {
        heading: '4. Account security',
        paragraphs: [
          'The user must take reasonable steps to prevent unauthorised access to their account.',
          'Sharing, assigning, selling, or transferring credentials is prohibited where incompatible with the terms of the service.',
          'If the account is suspected of being compromised, used without authorisation, or having its credentials disclosed, the user must report the situation to Pixgo through the official support channels.',
          'Pixgo may temporarily suspend an account where there are reasonable indications of a security breach, fraud, abuse, or use incompatible with these Terms and Conditions.',
        ],
      },
      {
        heading: '5. Services provided',
        paragraphs: [
          'Pixgo provides digital services for processing, transforming, creating, organising, and managing digital content.',
          'Available features may vary depending on the contracted plan, technical requirements, operational capacity, Platform updates, and other applicable conditions.',
          'Pixgo may add, change, improve, limit, replace, suspend, or remove features, provided that legally acquired user rights and applicable contractual obligations are respected.',
          'The availability of a given feature at a given time does not guarantee that it will remain permanently unchanged.',
        ],
      },
      {
        heading: '6. Use of the services',
        paragraphs: [
          'The services must be used exclusively for lawful purposes and in accordance with applicable law.',
          'The user is responsible for the files, documents, images, information, and other content they enter, process, upload, transmit, or generate through the Platform.',
          'The user represents and warrants that they hold the rights, authorisations, or legal grounds necessary to use and process the submitted content.',
          'Pixgo does not grant the user any authorisation to use content belonging to third parties where such use is not legally permitted.',
        ],
      },
      {
        heading: '7. User content',
        paragraphs: [
          'Content submitted by the user remains subject to whatever ownership rights legally apply to it.',
          'Using the Platform does not, by itself, transfer ownership of the user\'s content to Pixgo.',
          'To enable the requested services to be carried out, the user grants Pixgo only the technical authorisations necessary to receive, process, temporarily store, transmit, or make the content available within the scope of the feature used.',
          'These authorisations are limited to the purpose of providing the services and do not grant Pixgo a general right to commercially exploit the user\'s content.',
          'The user remains responsible for the legality of the submitted content and for holding the rights necessary for its use.',
        ],
      },
      {
        heading: '8. Prohibited content',
        paragraphs: [
          'Using the Platform to store, process, transmit, or make available content whose use is illegal or infringes third-party rights is prohibited.',
          'Using the services for fraudulent, abusive, deceptive, malicious activities, or activities intended to compromise the operation or security of the Platform, is likewise prohibited.',
          'Where Pixgo becomes aware of a clearly unlawful use, or one incompatible with these Terms and Conditions, it may adopt technically and legally permitted measures, including restricting access, removing content where applicable, suspending features, or closing accounts.',
          'Where necessary, certain information may be preserved or disclosed to comply with legal obligations or orders issued by competent authorities.',
        ],
      },
      {
        heading: '9. Acceptable use of the Platform',
        paragraphs: [
          'The following is expressly prohibited:',
        ],
        list: [
          'attempting to gain unauthorised access to Pixgo\'s accounts, systems, servers, databases, or restricted areas;',
          'exploiting vulnerabilities, flaws, or security mechanisms of the Platform;',
          'circumventing authentication mechanisms, access controls, technical limits, or restrictions associated with plans;',
          'using methods intended to interfere with the availability, stability, or integrity of the Platform;',
          'carrying out abusive automated activity that causes excessive load or use incompatible with the normal purpose of the services;',
          'using bots, scripts, crawlers, scrapers, or similar mechanisms to exploit the services without authorisation;',
          'attempting to obtain features, resources, or benefits without meeting the applicable conditions;',
          'using false identities or fraudulent information to gain access to the services;',
          'using the Platform for activities that could cause harm to other users or third parties;',
          'reverse-engineering, decompiling, or disassembling components of the Platform, except where expressly permitted by applicable law;',
          'reproducing, copying, reselling, or commercially making available Pixgo\'s services without authorisation.',
        ],
        note: 'Violation of these provisions may result in security and administrative measures, including limiting, suspending, or closing the account, without prejudice to other legally permissible measures.',
      },
      {
        heading: '10. Free plans',
        paragraphs: [
          'Pixgo may offer a free tier of use.',
          'The free plan may be subject to usage limits, functional restrictions, advertising, processing or capacity limits, or other conditions presented on the Platform.',
          'Pixgo may change the conditions of the free plan, provided that legally applicable rights are respected.',
          'Offering certain services for free does not create an obligation to indefinitely maintain those services unchanged.',
        ],
      },
      {
        heading: '11. Paid plans',
        paragraphs: [
          'Pixgo may offer paid plans, with different features, limits, usage periods, and commercial conditions.',
          'The characteristics of each plan will be presented before contracting.',
          'Contracting a paid plan grants the user the right to use the included services during the contracted period, in accordance with the conditions in effect at the time of contracting and with these Terms and Conditions.',
          'Access to specific features may be subject to technical or usage limits expressly presented on the Platform.',
        ],
      },
      {
        heading: '12. Prices and payments',
        paragraphs: [
          'The prices applicable to paid services are those presented by Pixgo at the time of contracting.',
          'Payments may be processed by external payment service providers, in accordance with their respective terms and policies.',
          'Pixgo may change plan prices for future contracts or renewal periods, respecting consumer rights and applicable legal obligations.',
          'The user is responsible for providing valid payment information and for ensuring they are authorised to use the selected payment method.',
          'Pixgo is not responsible for processing failures directly attributable to the external payment provider, without prejudice to the rights legally granted to the user against Pixgo.',
        ],
      },
      {
        heading: '13. Subscriptions and renewal',
        paragraphs: [
          'Where a plan is offered as a subscription, the service may renew automatically according to the periodicity selected at the time of contracting.',
          'The user may cancel the renewal through the mechanisms available in the account area or another method indicated by the Platform.',
          'Cancelling a subscription does not necessarily mean immediate interruption of access to the paid services. Unless otherwise provided by law or contract, access will remain available until the end of the already-paid period.',
          'After the contracted period ends, access to the exclusive features of the paid plan may be closed or converted to a free tier, where available.',
        ],
      },
      {
        heading: '14. Cancellation and refunds',
        paragraphs: [
          'Requests for cancellation, refund, or termination will be handled according to the conditions presented at the time of contracting and applicable law.',
          'Cancelling a future subscription does not, by itself, entail an automatic refund of periods already used.',
          'Consumers\' legal rights, including any statutory rights of withdrawal, cooling-off, or mandatory refund, remain fully preserved.',
          'Where a refund is due, processing may depend on the payment method used and the procedures of the relevant provider.',
        ],
      },
      {
        heading: '15. Service warranty and compliance',
        paragraphs: [
          'Pixgo seeks to provide the services in accordance with the characteristics presented at the time of contracting.',
          'Digital services may present errors, temporary unavailability, technical limitations, or incompatibilities arising from internal or external factors.',
          'Where a significant failure prevents the normal use of a feature included in a paid plan, the user may report the problem to support.',
          'Pixgo will seek to fix technical failures within a reasonable time, considering the nature and complexity of the problem.',
          'Where applicable and required by consumer-protection law, corrective measures, extension of the contracted period, proportional price reduction, refund, or other legally provided remedies may be made available.',
        ],
      },
      {
        heading: '16. Availability and maintenance',
        paragraphs: [
          'Pixgo seeks to keep the Platform continuously available and to ensure adequate levels of performance, stability, and security.',
          'However, uninterrupted availability or the absolute absence of failures cannot be guaranteed.',
          'The Platform may experience interruptions due to maintenance, updates, infrastructure failures, connectivity problems, security incidents, provider unavailability, technical changes, force-majeure events, or other circumstances beyond Pixgo\'s reasonable control.',
          'Whenever possible, scheduled interventions that could significantly affect use will be communicated through the available channels.',
          'The existence of periods of unavailability does not, by itself, constitute a breach of contract when resulting from justified circumstances and handled in accordance with applicable law.',
        ],
      },
      {
        heading: '17. Support',
        paragraphs: [
          'Pixgo provides official support channels for clarifying questions, reporting technical problems, and assisting with the use of the Platform.',
          'Support may be provided according to the operational availability of the responsible team and the conditions applicable to each type of service.',
          'Requests related to unavailability, security, payments, or inability to access may receive priority handling depending on their nature.',
          'Submitting a support request does not guarantee an immediate resolution, especially when the problem depends on third parties or complex technical circumstances.',
        ],
      },
      {
        heading: '18. Pixgo\'s intellectual property',
        paragraphs: [
          'All intellectual property rights relating to the Platform and its components belong to Pixgo or the relevant licensing rights holders, as applicable.',
          'This includes, among others, the software, code, architecture, interfaces, graphic elements, visual identity, trademarks, trade names, text, documentation, databases, structures, features, and proprietary content.',
          'Using the Platform does not grant the user any licence or ownership right beyond what is strictly necessary to use the services in accordance with these Terms and Conditions.',
          'Unauthorised reproduction, distribution, commercial exploitation, public disclosure, or modification of protected elements of the Platform is prohibited.',
        ],
      },
      {
        heading: '19. Rights over generated results',
        paragraphs: [
          'Where the services produce files, documents, or other results from content provided by the user, the rights over those results will be determined according to the nature of the content, pre-existing rights, and applicable law.',
          'Using the Platform does not automatically transfer to Pixgo any ownership rights over results belonging to the user.',
          'The user is responsible for verifying whether the use, publication, distribution, or exploitation of the produced results is permitted under applicable law and third-party rights.',
        ],
      },
      {
        heading: '20. Third-party services and components',
        paragraphs: [
          'The Platform may depend on services, infrastructure, technologies, or components provided by third parties.',
          'Use of these components may be subject to additional conditions set by their respective providers.',
          'Pixgo will seek to select and operate these services appropriately, but does not fully control the availability, changes, or policies of third parties.',
          'Interruptions or changes caused by external providers may affect certain features of the Platform.',
        ],
      },
      {
        heading: '21. Privacy and data protection',
        paragraphs: [
          'The processing of personal data carried out in the context of using Pixgo is governed by the Platform\'s Privacy Policy.',
          'The user should consult that policy to learn about the categories of data processed, purposes, legal grounds, retention periods, data-subject rights, and other relevant information.',
          'Pixgo commits to processing personal data in accordance with applicable law and its published policies.',
        ],
      },
      {
        heading: '22. Advertising',
        paragraphs: [
          'Pixgo may display advertising in certain modes of use.',
          'Advertising may be provided by third-party entities and may vary depending on technical factors, context, availability, and service configuration.',
          'Displaying advertising does not mean Pixgo recommends, guarantees, or takes responsibility for the products or services advertised by third parties.',
          'Conditions relating to advertising may vary depending on the contracted plan.',
        ],
      },
      {
        heading: '23. Limitation of liability',
        paragraphs: [
          'To the maximum extent permitted by applicable law, Pixgo will not be liable for damages resulting from improper use of the Platform, use contrary to these Terms and Conditions, failures caused by third parties, or events that cannot reasonably be controlled by Pixgo.',
          'Pixgo does not guarantee that the results obtained through the services are suitable for a specific purpose, complete, accurate, or legally sufficient for any particular use, unless expressly stated.',
          'The user must assess and verify the results produced before using them in relevant situations.',
          'Where processed content is important, the user must keep independent backup copies.',
          'Nothing in these Terms and Conditions excludes or limits liabilities that cannot legally be excluded or limited.',
        ],
      },
      {
        heading: '24. Data loss',
        paragraphs: [
          'Although Pixgo adopts measures intended to preserve the integrity of the services, it cannot guarantee that any content submitted to the Platform will remain permanently available.',
          'Files or other content may be subject to temporary processing, automatic deletion, storage limitations, or other technical conditions.',
          'The user is responsible for keeping backup copies of content whose preservation is important.',
          'Pixgo must not be used as the sole permanent storage mechanism for essential content, except where a service expressly intended for that purpose has been provided and contracted.',
        ],
      },
      {
        heading: '25. Suspension and closure of the account',
        paragraphs: [
          'Pixgo may suspend, limit, or close an account where there are grounds related to violation of these Terms and Conditions, fraud, abuse, security risks, unlawful use, non-compliance with financial obligations, or legal requirements.',
          'Whenever legally possible and reasonable, Pixgo may inform the user of the measure adopted and its grounds.',
          'In situations of immediate risk to the security of the Platform, users, or third parties, suspension may occur without prior notice.',
          'The user may request closure of their account through the mechanisms provided by the Platform.',
          'Closing the account does not eliminate obligations that, by their nature, must remain in effect after use ends.',
        ],
      },
      {
        heading: '26. Changes to the Platform',
        paragraphs: [
          'Pixgo may modify the structure, appearance, architecture, features, technical requirements, and operating conditions of the Platform.',
          'These changes may be made to improve performance, security, compatibility, user experience, legal compliance, or operational sustainability.',
          'Where a change materially affects a paid service during a contracted period, the user\'s legally applicable rights will be respected.',
        ],
      },
      {
        heading: '27. Changes to the Terms and Conditions',
        paragraphs: [
          'Pixgo may update these Terms and Conditions to reflect changes to the services, legislation, operational processes, or security requirements.',
          'The updated version will be made available on the Platform and identified by its update date.',
          'Where applicable law requires specific notice or express acceptance of certain changes, the corresponding procedures will be adopted.',
          'Continued use of the Platform after changes take effect constitutes acceptance of the new Terms and Conditions to the extent permitted by applicable law.',
        ],
      },
      {
        heading: '28. Electronic communications',
        paragraphs: [
          'The user agrees to receive communications related to account operation, security, payments, significant service changes, maintenance, and other matters necessary to provide the Platform, through the communication channels associated with their account.',
          'Commercial communications will be made in accordance with the user\'s preferences and applicable law.',
          'The user must keep their contact details up to date to ensure receipt of important communications.',
        ],
      },
      {
        heading: '29. Compliance with the law',
        paragraphs: [
          'Use of Pixgo is subject to applicable law.',
          'The user undertakes to use the Platform in compliance with all rules applicable to them, including rules on intellectual property, data protection, computer security, digital content, third-party rights, and use of electronic services.',
          'Pixgo may cooperate with competent authorities where legally required.',
        ],
      },
      {
        heading: '30. Force majeure',
        paragraphs: [
          'Pixgo will not be held liable for delays or failure to fulfil certain obligations where these result from events beyond its reasonable control.',
          'Such situations may include, among others, natural disasters, conflicts, acts of authorities, widespread telecommunications outages, critical infrastructure failures, large-scale cyberattacks, unavailability of essential providers, or other extraordinary circumstances.',
          'Pixgo will seek to take reasonable measures to reduce the effects of such situations and restore services as soon as possible.',
        ],
      },
      {
        heading: '31. Severability',
        paragraphs: [
          'If any provision of these Terms and Conditions is deemed invalid, illegal, or unenforceable by a competent authority, that provision will be applied to the maximum extent permitted by applicable law.',
          'The invalidity of any provision will not affect the validity of the remaining provisions.',
        ],
      },
      {
        heading: '32. No waiver',
        paragraphs: [
          'Failure to immediately exercise any right provided for in these Terms and Conditions does not constitute a waiver of that right.',
          'Any waiver must be interpreted narrowly and will not prevent the later exercise of similar rights, unless otherwise provided by law or contract.',
        ],
      },
      {
        heading: '33. Relationship between the user and Pixgo',
        paragraphs: [
          'Use of the Platform does not, by itself, create any partnership, representation, agency, employment, or association relationship between the user and Pixgo.',
          'The user must not present themselves to third parties as a representative or authorised agent of Pixgo without express authorisation.',
        ],
      },
      {
        heading: '34. Governing law and dispute resolution',
        paragraphs: [
          'These Terms and Conditions will be interpreted in accordance with the law applicable to the relationship between Pixgo and the user.',
          'Where applicable consumer-protection law exists, nothing in these Terms and Conditions is intended to exclude or restrict mandatory rights granted to the consumer.',
          'The parties will seek, whenever possible, to amicably resolve any disputes related to the use of the Platform.',
          'Without prejudice to the user\'s legally granted rights, disputes will be submitted to the competent authorities or courts under applicable law.',
        ],
      },
      {
        heading: '35. Contact',
        paragraphs: [
          'Questions related to these Terms and Conditions, use of the Platform, payments, security, or support may be submitted through the official contact channels provided by Pixgo.',
        ],
        contactEmail: 'support@pixgo.qzz.io',
      },
      {
        heading: '36. Version of the Terms',
        paragraphs: [
          'These Terms and Conditions correspond to the version made available by Pixgo in August 2026.',
          'The date indicated at the top of this page identifies the currently published version.',
          'Use of the Platform after a new version takes effect will be subject to the Terms and Conditions then in force, respecting the rights legally applicable to users.',
        ],
      },
    ],
  },
  es: {
    title: 'Términos y condiciones',
    kicker: 'Documento legal',
    subtitle: 'Condiciones de uso de la plataforma Pixgo y de sus herramientas.',
    updated: 'Actualizado en agosto de 2026',
    sections: [
      {
        heading: 'Ámbito general',
        paragraphs: [
          'Condiciones generales de acceso y uso de la plataforma digital Pixgo.',
        ],
      },
      {
        heading: '1. Objeto y ámbito de aplicación',
        paragraphs: [
          'Los presentes Términos y Condiciones regulan el acceso, registro y uso de la plataforma digital Pixgo, incluidos los respectivos servicios, funcionalidades, sistemas, interfaces y recursos ofrecidos a los usuarios.',
          'Pixgo constituye una plataforma digital destinada a ofrecer servicios tecnológicos de productividad, procesamiento, transformación, creación y gestión de contenidos digitales.',
          'Al crear una cuenta, acceder a la Plataforma, contratar un plan o utilizar cualquier servicio ofrecido por Pixgo, el usuario declara que ha leído, comprendido y aceptado los presentes Términos y Condiciones, así como las demás políticas y documentos legales aplicables.',
          'Si el usuario no está de acuerdo con alguna disposición de estos Términos y Condiciones, deberá dejar de utilizar la Plataforma.',
        ],
      },
      {
        heading: '2. Elegibilidad y capacidad para el uso',
        paragraphs: [
          'El uso de Pixgo está sujeto a la legislación aplicable al usuario y al territorio desde el cual se utilizan los servicios.',
          'El usuario declara poseer capacidad legal para aceptar estos Términos y Condiciones y para asumir las obligaciones que de ellos se derivan.',
          'Cuando el uso de la Plataforma esté sujeto a requisitos específicos de edad, autorización, representación o capacidad jurídica, deberán observarse las exigencias establecidas por la legislación aplicable.',
          'Pixgo podrá restringir o impedir el acceso cuando existan razones legales, técnicas o de seguridad que justifiquen esa medida.',
        ],
      },
      {
        heading: '3. Registro y creación de cuenta',
        paragraphs: [
          'Determinadas funcionalidades de Pixgo podrán requerir la creación de una cuenta de usuario.',
          'En el momento del registro, el usuario deberá proporcionar información veraz, completa y actualizada, asumiendo la responsabilidad por la exactitud de los datos proporcionados.',
          'El usuario es responsable de mantener actualizados los datos de la cuenta y de comunicar cualquier cambio relevante.',
          'Las credenciales de acceso son personales y deben mantenerse bajo confidencialidad. El usuario es responsable de las actividades realizadas a través de su cuenta, salvo que demuestre que estas ocurrieron sin su autorización y por circunstancias que no le sean imputables.',
          'Pixgo podrá solicitar procedimientos adicionales de verificación o seguridad siempre que sea necesario para proteger la cuenta, la Plataforma o sus usuarios.',
        ],
      },
      {
        heading: '4. Seguridad de la cuenta',
        paragraphs: [
          'El usuario debe adoptar medidas razonables para impedir el acceso no autorizado a su cuenta.',
          'Queda prohibido compartir, ceder, comercializar o transferir credenciales cuando ello sea incompatible con las condiciones del servicio.',
          'En caso de sospecha de compromiso de la cuenta, uso no autorizado o divulgación de las credenciales, el usuario deberá comunicar la situación a Pixgo a través de los canales oficiales de soporte.',
          'Pixgo podrá suspender temporalmente una cuenta cuando existan indicios razonables de compromiso de seguridad, fraude, abuso o uso incompatible con estos Términos y Condiciones.',
        ],
      },
      {
        heading: '5. Servicios ofrecidos',
        paragraphs: [
          'Pixgo ofrece servicios digitales destinados al procesamiento, transformación, creación, organización y gestión de contenidos digitales.',
          'Las funcionalidades disponibles pueden variar según el plan contratado, los requisitos técnicos, la capacidad operativa, las actualizaciones de la Plataforma y demás condiciones aplicables.',
          'Pixgo podrá añadir, modificar, mejorar, limitar, sustituir, suspender o eliminar funcionalidades, siempre que se respeten los derechos legalmente adquiridos por los usuarios y las obligaciones contractuales aplicables.',
          'La disponibilidad de una determinada funcionalidad en un momento dado no constituye garantía de que permanecerá permanentemente inalterada.',
        ],
      },
      {
        heading: '6. Uso de los servicios',
        paragraphs: [
          'Los servicios deben utilizarse exclusivamente para fines legítimos y de acuerdo con la legislación aplicable.',
          'El usuario es responsable de los archivos, documentos, imágenes, información y demás contenidos que introduzca, procese, cargue, transmita o genere a través de la Plataforma.',
          'El usuario declara y garantiza que posee los derechos, autorizaciones o fundamentos jurídicos necesarios para utilizar y procesar los contenidos enviados.',
          'Pixgo no concede al usuario ninguna autorización para utilizar contenidos pertenecientes a terceros cuando dicho uso no esté legalmente permitido.',
        ],
      },
      {
        heading: '7. Contenidos del usuario',
        paragraphs: [
          'Los contenidos enviados por el usuario permanecen sujetos a los derechos de propiedad que legalmente les correspondan.',
          'El uso de la Plataforma no implica, por sí solo, la transferencia de la propiedad de los contenidos del usuario a Pixgo.',
          'Para permitir la ejecución de los servicios solicitados, el usuario concede a Pixgo únicamente las autorizaciones técnicas necesarias para recibir, procesar, almacenar temporalmente, transmitir o poner a disposición los contenidos en el ámbito de la funcionalidad utilizada.',
          'Estas autorizaciones se limitan a la finalidad de la prestación de los servicios y no otorgan a Pixgo un derecho general de explotación comercial de los contenidos del usuario.',
          'El usuario sigue siendo responsable de la legalidad de los contenidos enviados y de contar con los derechos necesarios para su uso.',
        ],
      },
      {
        heading: '8. Contenidos prohibidos',
        paragraphs: [
          'Queda prohibido utilizar la Plataforma para almacenar, procesar, transmitir o poner a disposición contenidos cuyo uso sea ilegal o que vulnere derechos de terceros.',
          'Igualmente queda prohibido utilizar los servicios para actividades fraudulentas, abusivas, engañosas, maliciosas o destinadas a comprometer el funcionamiento o la seguridad de la Plataforma.',
          'Cuando Pixgo tenga conocimiento de un uso manifiestamente ilícito o incompatible con estos Términos y Condiciones, podrá adoptar las medidas técnica y legalmente permitidas, incluyendo la restricción del acceso, la eliminación de contenidos cuando corresponda, la suspensión de funcionalidades o el cierre de cuentas.',
          'Cuando sea necesario, determinada información podrá conservarse o divulgarse para cumplir obligaciones legales o resoluciones emitidas por autoridades competentes.',
        ],
      },
      {
        heading: '9. Uso aceptable de la Plataforma',
        paragraphs: [
          'Queda expresamente prohibido:',
        ],
        list: [
          'intentar obtener acceso no autorizado a cuentas, sistemas, servidores, bases de datos o áreas restringidas de Pixgo;',
          'explotar vulnerabilidades, fallos o mecanismos de seguridad de la Plataforma;',
          'eludir mecanismos de autenticación, control de acceso, límites técnicos o restricciones asociadas a los planes;',
          'utilizar métodos destinados a interferir con la disponibilidad, estabilidad o integridad de la Plataforma;',
          'realizar actividades automatizadas abusivas que provoquen una carga excesiva o un uso incompatible con la finalidad normal de los servicios;',
          'utilizar bots, scripts, crawlers, scrapers o mecanismos similares para explotar los servicios sin autorización;',
          'intentar obtener funcionalidades, recursos o beneficios sin cumplir las condiciones aplicables;',
          'utilizar identidades falsas o información fraudulenta para obtener acceso a los servicios;',
          'utilizar la Plataforma para actividades que puedan causar perjuicio a otros usuarios o terceros;',
          'realizar ingeniería inversa, descompilación o desensamblaje de los componentes de la Plataforma, salvo que esté expresamente permitido por la legislación aplicable;',
          'reproducir, copiar, revender o poner a disposición comercialmente los servicios de Pixgo sin autorización.',
        ],
        note: 'La infracción de estas disposiciones podrá dar lugar a la aplicación de medidas de seguridad y administrativas, incluyendo la limitación, suspensión o cierre de la cuenta, sin perjuicio de otras medidas legalmente admisibles.',
      },
      {
        heading: '10. Planes gratuitos',
        paragraphs: [
          'Pixgo podrá ofrecer una modalidad de uso gratuita.',
          'El plan gratuito podrá estar sujeto a límites de uso, restricciones funcionales, publicidad, límites de procesamiento o capacidad, u otras condiciones presentadas en la Plataforma.',
          'Pixgo podrá modificar las condiciones del plan gratuito, siempre que se respeten los derechos legalmente aplicables.',
          'La oferta gratuita de determinados servicios no crea una obligación de mantenerlos indefinidamente sin cambios.',
        ],
      },
      {
        heading: '11. Planes de pago',
        paragraphs: [
          'Pixgo podrá ofrecer planes sujetos a pago, con diferentes funcionalidades, límites, períodos de uso y condiciones comerciales.',
          'Las características de cada plan se presentarán antes de la contratación.',
          'La contratación de un plan de pago otorga al usuario el derecho a utilizar los servicios incluidos durante el período contratado, de acuerdo con las condiciones vigentes en el momento de la contratación y con estos Términos y Condiciones.',
          'El acceso a funcionalidades específicas podrá estar sujeto a límites técnicos o de uso expresamente presentados en la Plataforma.',
        ],
      },
      {
        heading: '12. Precios y pagos',
        paragraphs: [
          'Los precios aplicables a los servicios de pago son los presentados por Pixgo en el momento de la contratación.',
          'Los pagos podrán ser procesados por proveedores externos de servicios de pago, de acuerdo con sus respectivos términos y políticas.',
          'Pixgo podrá modificar los precios de los planes para futuras contrataciones o períodos de renovación, respetando los derechos de los consumidores y las obligaciones legales aplicables.',
          'El usuario es responsable de proporcionar información de pago válida y de garantizar que dispone de autorización para utilizar el método de pago seleccionado.',
          'Pixgo no es responsable de los fallos de procesamiento directamente imputables al proveedor externo de pagos, sin perjuicio de los derechos legalmente reconocidos al usuario frente a Pixgo.',
        ],
      },
      {
        heading: '13. Suscripciones y renovación',
        paragraphs: [
          'Cuando un plan se ofrezca como suscripción, el servicio podrá renovarse automáticamente de acuerdo con la periodicidad seleccionada en el momento de la contratación.',
          'El usuario podrá cancelar la renovación a través de los mecanismos disponibles en el área de cuenta o por otro método indicado por la Plataforma.',
          'La cancelación de una suscripción no implica necesariamente la interrupción inmediata del acceso a los servicios de pago. Salvo disposición legal o contractual en contrario, el acceso permanecerá disponible hasta el final del período ya pagado.',
          'Tras la finalización del período contratado, el acceso a las funcionalidades exclusivas del plan de pago podrá cerrarse o convertirse en una modalidad gratuita, cuando esté disponible.',
        ],
      },
      {
        heading: '14. Cancelación y reembolsos',
        paragraphs: [
          'Las solicitudes de cancelación, reembolso o resolución se tratarán de acuerdo con las condiciones presentadas en el momento de la contratación y con la legislación aplicable.',
          'La cancelación de una suscripción futura no implica, por sí sola, el reembolso automático de períodos ya utilizados.',
          'Los derechos legales de los consumidores, incluidos los eventuales derechos de resolución, desistimiento o reembolso obligatorios por ley, permanecen íntegramente preservados.',
          'Cuando se deba un reembolso, su procesamiento podrá depender del método de pago utilizado y de los procedimientos del respectivo proveedor.',
        ],
      },
      {
        heading: '15. Garantía y conformidad del servicio',
        paragraphs: [
          'Pixgo procura ofrecer los servicios de acuerdo con las características presentadas en el momento de la contratación.',
          'Los servicios digitales pueden presentar errores, indisponibilidades temporales, limitaciones técnicas o incompatibilidades derivadas de factores internos o externos.',
          'Cuando un fallo relevante impida el uso normal de una funcionalidad incluida en un plan de pago, el usuario podrá comunicar el problema al soporte.',
          'Pixgo procurará corregir los fallos técnicos dentro de un plazo razonable, considerando la naturaleza y complejidad del problema.',
          'Cuando corresponda y lo exija la legislación de protección al consumidor, podrán ofrecerse medidas correctivas, extensión del período contratado, reducción proporcional del precio, reembolso u otras soluciones legalmente previstas.',
        ],
      },
      {
        heading: '16. Disponibilidad y mantenimiento',
        paragraphs: [
          'Pixgo procura mantener la Plataforma disponible de forma continua y garantizar niveles adecuados de rendimiento, estabilidad y seguridad.',
          'No obstante, no es posible garantizar una disponibilidad ininterrumpida ni la ausencia absoluta de fallos.',
          'La Plataforma podrá sufrir interrupciones debido a mantenimiento, actualizaciones, fallos de infraestructura, problemas de conectividad, incidentes de seguridad, indisponibilidad de proveedores, cambios técnicos, acontecimientos de fuerza mayor u otras circunstancias fuera del control razonable de Pixgo.',
          'Siempre que sea posible, las intervenciones programadas que puedan afectar significativamente el uso se comunicarán a través de los canales disponibles.',
          'La existencia de períodos de indisponibilidad no constituye, por sí sola, un incumplimiento contractual cuando resulte de circunstancias justificadas y se gestione de acuerdo con la legislación aplicable.',
        ],
      },
      {
        heading: '17. Soporte',
        paragraphs: [
          'Pixgo ofrece canales oficiales de soporte destinados a aclarar dudas, comunicar problemas técnicos y prestar asistencia relacionada con el uso de la Plataforma.',
          'El soporte podrá prestarse de acuerdo con la disponibilidad operativa del equipo responsable y con las condiciones aplicables a cada modalidad de servicio.',
          'Las solicitudes relacionadas con indisponibilidad, seguridad, pagos o imposibilidad de acceso podrán recibir un tratamiento prioritario según su naturaleza.',
          'La presentación de una solicitud de soporte no garantiza una resolución inmediata, especialmente cuando el problema dependa de terceros o de circunstancias técnicas complejas.',
        ],
      },
      {
        heading: '18. Propiedad intelectual de Pixgo',
        paragraphs: [
          'Todos los derechos de propiedad intelectual relacionados con la Plataforma y sus componentes pertenecen a Pixgo o a los respectivos titulares licenciantes, según corresponda.',
          'Se incluyen, entre otros, el software, código, arquitectura, interfaces, elementos gráficos, identidad visual, marcas, nombres comerciales, textos, documentación, bases de datos, estructuras, funcionalidades y contenidos propios.',
          'El uso de la Plataforma no otorga al usuario ninguna licencia o derecho de propiedad más allá de lo estrictamente necesario para utilizar los servicios de acuerdo con estos Términos y Condiciones.',
          'Queda prohibida la reproducción, distribución, explotación comercial, divulgación pública o modificación no autorizada de elementos protegidos de la Plataforma.',
        ],
      },
      {
        heading: '19. Derechos sobre los resultados generados',
        paragraphs: [
          'Cuando los servicios produzcan archivos, documentos u otros resultados a partir de contenidos proporcionados por el usuario, los derechos sobre esos resultados se determinarán según la naturaleza del contenido, los derechos preexistentes y la legislación aplicable.',
          'El uso de la Plataforma no transfiere automáticamente a Pixgo derechos de propiedad sobre resultados pertenecientes al usuario.',
          'El usuario es responsable de verificar si el uso, publicación, distribución o explotación de los resultados producidos está permitido por la legislación aplicable y por los derechos de terceros.',
        ],
      },
      {
        heading: '20. Servicios y componentes de terceros',
        paragraphs: [
          'La Plataforma podrá depender de servicios, infraestructuras, tecnologías o componentes proporcionados por terceros.',
          'El uso de estos componentes podrá estar sujeto a condiciones adicionales establecidas por sus respectivos proveedores.',
          'Pixgo procurará seleccionar y operar estos servicios de forma adecuada, pero no controla íntegramente la disponibilidad, los cambios o las políticas de terceros.',
          'Las interrupciones o los cambios provocados por proveedores externos podrán afectar a determinadas funcionalidades de la Plataforma.',
        ],
      },
      {
        heading: '21. Privacidad y protección de datos',
        paragraphs: [
          'El tratamiento de datos personales realizado en el ámbito del uso de Pixgo se rige por la Política de Privacidad de la Plataforma.',
          'El usuario deberá consultar dicha política para conocer las categorías de datos tratados, las finalidades, los fundamentos jurídicos, los períodos de conservación, los derechos de los titulares y demás información relevante.',
          'Pixgo se compromete a tratar los datos personales de acuerdo con la legislación aplicable y con sus políticas publicadas.',
        ],
      },
      {
        heading: '22. Publicidad',
        paragraphs: [
          'Pixgo podrá presentar publicidad en determinadas modalidades de uso.',
          'La publicidad podrá ser ofrecida por entidades terceras y podrá variar según factores técnicos, contexto, disponibilidad y configuración del servicio.',
          'La presentación de publicidad no significa que Pixgo recomiende, garantice o asuma responsabilidad por los productos o servicios anunciados por terceros.',
          'Las condiciones relativas a la publicidad podrán variar según el plan contratado.',
        ],
      },
      {
        heading: '23. Limitación de responsabilidad',
        paragraphs: [
          'En la máxima medida permitida por la legislación aplicable, Pixgo no será responsable de los daños derivados de un uso inadecuado de la Plataforma, un uso contrario a los presentes Términos y Condiciones, fallos provocados por terceros o acontecimientos que no puedan ser razonablemente controlados por Pixgo.',
          'Pixgo no garantiza que los resultados obtenidos a través de los servicios sean adecuados para una finalidad específica, completos, exactos o jurídicamente suficientes para cualquier uso particular, salvo que se establezca expresamente.',
          'El usuario debe evaluar y verificar los resultados producidos antes de utilizarlos en situaciones relevantes.',
          'Cuando los contenidos procesados sean importantes, el usuario debe mantener copias de seguridad independientes.',
          'Nada en estos Términos y Condiciones excluye o limita responsabilidades que no puedan ser legalmente excluidas o limitadas.',
        ],
      },
      {
        heading: '24. Pérdida de datos',
        paragraphs: [
          'Aunque Pixgo adopta medidas destinadas a preservar la integridad de los servicios, no puede garantizar que cualquier contenido enviado a la Plataforma permanecerá disponible de forma permanente.',
          'Los archivos u otros contenidos podrán estar sujetos a procesamiento temporal, eliminación automática, limitaciones de almacenamiento u otras condiciones técnicas.',
          'El usuario es responsable de mantener copias de seguridad de los contenidos cuya conservación sea importante.',
          'Pixgo no debe utilizarse como único mecanismo de almacenamiento permanente de contenidos esenciales, salvo que se haya ofrecido y contratado expresamente un servicio con esa finalidad.',
        ],
      },
      {
        heading: '25. Suspensión y cierre de la cuenta',
        paragraphs: [
          'Pixgo podrá suspender, limitar o cerrar una cuenta cuando existan motivos relacionados con la infracción de estos Términos y Condiciones, fraude, abuso, riesgos de seguridad, uso ilícito, incumplimiento de obligaciones financieras o exigencias legales.',
          'Siempre que sea legalmente posible y razonable, Pixgo podrá comunicar al usuario la medida adoptada y su fundamento.',
          'En situaciones de riesgo inmediato para la seguridad de la Plataforma, de los usuarios o de terceros, la suspensión podrá producirse sin aviso previo.',
          'El usuario podrá solicitar el cierre de su cuenta a través de los mecanismos ofrecidos por la Plataforma.',
          'El cierre de la cuenta no elimina las obligaciones que, por su naturaleza, deban permanecer vigentes tras el fin del uso.',
        ],
      },
      {
        heading: '26. Cambios en la Plataforma',
        paragraphs: [
          'Pixgo podrá modificar la estructura, apariencia, arquitectura, funcionalidades, requisitos técnicos y condiciones operativas de la Plataforma.',
          'Estos cambios podrán realizarse para mejorar el rendimiento, la seguridad, la compatibilidad, la experiencia de uso, el cumplimiento legal o la sostenibilidad operativa.',
          'Cuando un cambio afecte materialmente a un servicio de pago durante un período contratado, se respetarán los derechos legalmente aplicables al usuario.',
        ],
      },
      {
        heading: '27. Cambios en los Términos y Condiciones',
        paragraphs: [
          'Pixgo podrá actualizar estos Términos y Condiciones para reflejar cambios en los servicios, en la legislación, en los procesos operativos o en los requisitos de seguridad.',
          'La versión actualizada se pondrá a disposición en la Plataforma e identificada por su fecha de actualización.',
          'Cuando la legislación aplicable exija una comunicación específica o la aceptación expresa de determinados cambios, se adoptarán los procedimientos correspondientes.',
          'La continuación del uso de la Plataforma tras la entrada en vigor de cambios constituye la aceptación de los nuevos Términos y Condiciones en la medida permitida por la legislación aplicable.',
        ],
      },
      {
        heading: '28. Comunicaciones electrónicas',
        paragraphs: [
          'El usuario acepta recibir comunicaciones relacionadas con el funcionamiento de la cuenta, la seguridad, los pagos, los cambios relevantes de los servicios, el mantenimiento y otras cuestiones necesarias para la prestación de la Plataforma, a través de los medios de comunicación asociados a la cuenta.',
          'Las comunicaciones de naturaleza comercial se realizarán de acuerdo con las preferencias del usuario y con la legislación aplicable.',
          'El usuario debe mantener actualizados sus datos de contacto para asegurar la recepción de comunicaciones importantes.',
        ],
      },
      {
        heading: '29. Cumplimiento de la legislación',
        paragraphs: [
          'El uso de Pixgo está sujeto a la legislación aplicable.',
          'El usuario se compromete a utilizar la Plataforma de conformidad con todas las normas que le sean aplicables, incluidas las normas relativas a propiedad intelectual, protección de datos, seguridad informática, contenidos digitales, derechos de terceros y uso de servicios electrónicos.',
          'Pixgo podrá cooperar con las autoridades competentes cuando así lo exija la ley.',
        ],
      },
      {
        heading: '30. Fuerza mayor',
        paragraphs: [
          'Pixgo no será considerada responsable de los retrasos o de la imposibilidad de cumplir determinadas obligaciones cuando estos resulten de acontecimientos fuera de su control razonable.',
          'Pueden constituir situaciones de esta naturaleza, entre otras, desastres naturales, conflictos, actos de autoridades, interrupciones generalizadas de telecomunicaciones, fallos críticos de infraestructura, ciberataques a gran escala, indisponibilidad de proveedores esenciales u otras circunstancias extraordinarias.',
          'Pixgo procurará adoptar medidas razonables para reducir los efectos de estas situaciones y restablecer los servicios en cuanto sea posible.',
        ],
      },
      {
        heading: '31. Independencia de las disposiciones',
        paragraphs: [
          'Si alguna disposición de estos Términos y Condiciones fuera considerada inválida, ilegal o inaplicable por una autoridad competente, dicha disposición se aplicará en la máxima medida permitida por la legislación aplicable.',
          'La eventual invalidez de una disposición no afectará la validez de las restantes disposiciones.',
        ],
      },
      {
        heading: '32. No renuncia',
        paragraphs: [
          'La ausencia de ejercicio inmediato de cualquier derecho previsto en estos Términos y Condiciones no constituye una renuncia a ese derecho.',
          'Cualquier renuncia deberá interpretarse de forma restrictiva y no impedirá el ejercicio posterior de derechos similares, salvo disposición legal o contractual en contrario.',
        ],
      },
      {
        heading: '33. Relación entre el usuario y Pixgo',
        paragraphs: [
          'El uso de la Plataforma no crea, por sí solo, ninguna relación de sociedad, representación, mandato, agencia, empleo o asociación entre el usuario y Pixgo.',
          'El usuario no podrá presentarse ante terceros como representante o agente autorizado de Pixgo sin autorización expresa.',
        ],
      },
      {
        heading: '34. Ley aplicable y resolución de conflictos',
        paragraphs: [
          'Los presentes Términos y Condiciones se interpretarán de acuerdo con la legislación aplicable a la relación entre Pixgo y el usuario.',
          'Siempre que exista legislación de protección al consumidor aplicable, ninguna disposición de estos Términos y Condiciones pretende excluir o restringir derechos imperativos otorgados al consumidor.',
          'Las partes procurarán, siempre que sea posible, resolver de forma amistosa cualquier discrepancia relacionada con el uso de la Plataforma.',
          'Sin perjuicio de los derechos legalmente atribuidos al usuario, los conflictos se someterán a las autoridades o tribunales competentes conforme a la legislación aplicable.',
        ],
      },
      {
        heading: '35. Contacto',
        paragraphs: [
          'Las cuestiones relacionadas con estos Términos y Condiciones, el uso de la Plataforma, los pagos, la seguridad o el soporte podrán presentarse a través de los canales oficiales de contacto ofrecidos por Pixgo.',
        ],
        contactEmail: 'support@pixgo.qzz.io',
      },
      {
        heading: '36. Versión de los Términos',
        paragraphs: [
          'Los presentes Términos y Condiciones corresponden a la versión publicada por Pixgo en agosto de 2026.',
          'La fecha indicada al inicio de esta página identifica la versión actualmente publicada.',
          'El uso de la Plataforma tras la entrada en vigor de una nueva versión estará sujeto a los Términos y Condiciones entonces vigentes, respetando los derechos legalmente aplicables a los usuarios.',
        ],
      },
    ],
  },
};

export default function TermsPage() {
  const lang = useLegalLang();
  return <LegalLayout content={CONTENT[lang]} icon={<GavelOutlinedIcon style={{ fontSize: 26, color: 'var(--color-primary)' }} />} />;
}
