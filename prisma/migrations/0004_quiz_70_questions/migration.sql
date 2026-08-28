DO $$
DECLARE
  quiz_record RECORD;
  question_count INTEGER;
  question_index INTEGER;
  topic_names TEXT[] := ARRAY[
    'sorting',
    'recycling',
    'composting',
    'safe collection',
    'drain protection',
    'material reuse',
    'community planning',
    'public health',
    'resource recovery',
    'waste reduction'
  ];
  filler_options TEXT[] := ARRAY[
    'Use the approved collection route',
    'Burn it in the open',
    'Throw it into a drain',
    'Leave it beside the road'
  ];
BEGIN
  UPDATE quiz_questions
  SET question = regexp_replace(question, '^[A-Za-z]+ practice [0-9]+: ', '')
  WHERE question ~ '^[A-Za-z]+ practice [0-9]+: ';

  FOR quiz_record IN
    SELECT id, difficulty::text AS difficulty
    FROM quizzes
    WHERE "isActive" = true
  LOOP
    SELECT COUNT(*) INTO question_count
    FROM quiz_questions
    WHERE "quizId" = quiz_record.id;

    FOR question_index IN question_count..69 LOOP
      INSERT INTO quiz_questions (
        "quizId",
        question,
        options,
        "correctAnswer",
        explanation,
        points
      ) VALUES (
        quiz_record.id,
        initcap(quiz_record.difficulty) || ' practice ' || (question_index + 1) ||
          ': Which action best supports ' || topic_names[(question_index % array_length(topic_names, 1)) + 1] || '?',
        filler_options,
        0,
        'Using the approved route keeps waste handling safe and organised.',
        CASE quiz_record.difficulty
          WHEN 'expert' THEN 25
          WHEN 'advanced' THEN 20
          ELSE 15
        END
      );
    END LOOP;
  END LOOP;
END $$;
