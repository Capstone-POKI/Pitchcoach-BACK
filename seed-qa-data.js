const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const pitchId = '06385611-df38-4543-bf39-7447a6d53f70';
  
  // Create QATraining
  const qaTraining = await prisma.qATraining.create({
    data: {
      pitchId,
      mode: 'GUIDE_ONLY',
      totalQuestions: 3,
      version: 1,
      isLatest: true,
    },
  });

  console.log('✅ QATraining 생성:', qaTraining.id);

  // Create QAQuestions
  const questions = [
    {
      category: 'PROBLEM',
      displayOrder: 1,
      question: '해결하려는 문제가 무엇인가요?',
      answerGuide: '',
    },
    {
      category: 'SOLUTION',
      displayOrder: 2,
      question: '어떤 솔루션을 제시하나요?',
      answerGuide: '',
    },
    {
      category: 'MARKET',
      displayOrder: 3,
      question: '타겟 시장의 규모는 얼마나 되나요?',
      answerGuide: '',
    },
  ];

  for (const q of questions) {
    const question = await prisma.qAQuestion.create({
      data: {
        qaTrainingId: qaTraining.id,
        category: q.category,
        displayOrder: q.displayOrder,
        question: q.question,
        answerGuide: q.answerGuide,
      },
    });
    console.log(`✅ 질문 생성: "${question.question}"`);
  }

  console.log('\n✅ 테스트 데이터 생성 완료!');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
