import type { ClientProfile, AdminToolQuestion } from '../types';

export interface PrefillResult {
  preFilledAnswers: string[];
  preFilledQuestions: string[];
  nextQuestionIndex: number;
  hasPrefilledData: boolean;
}

/**
 * Maps client profile fields to common question patterns
 */
const QUESTION_FIELD_MAPPING = [
  {
    patterns: ['target audience', 'audience', 'who is the audience', 'target market'],
    field: 'audience' as keyof ClientProfile,
    priority: 1
  },
  {
    patterns: ['tone', 'voice', 'tone of voice', 'writing style', 'brand voice'],
    field: 'tone' as keyof ClientProfile,
    priority: 2
  },
  {
    patterns: ['language', 'what language', 'preferred language'],
    field: 'language' as keyof ClientProfile,
    priority: 3
  },
  {
    patterns: ['client name', 'company name', 'brand name', 'business name'],
    field: 'name' as keyof ClientProfile,
    priority: 4
  },
  {
    patterns: ['sample', 'example', 'writing sample', 'style sample'],
    field: 'sample' as keyof ClientProfile,
    priority: 5
  }
];

/**
 * Determines if a question can be answered by a client profile field
 */
function matchQuestionToProfileField(questionLabel: string, clientProfile: ClientProfile): string | null {
  const questionLower = questionLabel.toLowerCase();
  
  Logger.info('PREFILL: Attempting to match question to profile field', {
    component: 'clientProfileHelper',
    questionLabel,
    profileName: clientProfile.name,
    availableFields: Object.keys(clientProfile).filter(key => 
      typeof clientProfile[key as keyof ClientProfile] === 'string' && 
      clientProfile[key as keyof ClientProfile]
    )
  });
  
  // Sort mappings by priority to ensure consistent matching order
  const sortedMappings = [...QUESTION_FIELD_MAPPING].sort((a, b) => a.priority - b.priority);
  
  for (const mapping of sortedMappings) {
    const hasMatch = mapping.patterns.some(pattern => questionLower.includes(pattern));
    
    if (hasMatch) {
      const fieldValue = clientProfile[mapping.field];
      
      // Return the value if it exists and is not empty
      if (fieldValue && typeof fieldValue === 'string' && fieldValue.trim()) {
        Logger.info('PREFILL: Successful question-to-field match found', {
          component: 'clientProfileHelper',
          questionLabel,
          matchedField: mapping.field,
          matchedPattern: mapping.patterns.find(pattern => questionLower.includes(pattern)),
          fieldValue: fieldValue.substring(0, 50) + (fieldValue.length > 50 ? '...' : ''),
          priority: mapping.priority
        });
        return fieldValue.trim();
      }
    }
  }
  
  Logger.info('PREFILL: No matching profile field found for question', {
    component: 'clientProfileHelper',
    questionLabel,
    profileName: clientProfile.name,
    checkedPatterns: QUESTION_FIELD_MAPPING.flatMap(m => m.patterns)
  });
  
  return null;
}

/**
 * Pre-fills tool questions using client profile data
 * Stops at the first question that cannot be answered
 */
export function prefillQuestionsFromClientProfile(
  questions: AdminToolQuestion[],
  clientProfile: ClientProfile | null
): PrefillResult {
  const result: PrefillResult = {
    preFilledAnswers: [],
    preFilledQuestions: [],
    nextQuestionIndex: 0,
    hasPrefilledData: false
  };
  
  // Return early if no client profile or questions
  if (!clientProfile || !questions || questions.length === 0) {
    return result;
  }
  
  // Sort questions by order to ensure correct sequence
  const sortedQuestions = [...questions].sort((a, b) => a.order - b.order);
  
  // Process questions sequentially until we find one we can't answer
  for (let i = 0; i < sortedQuestions.length; i++) {
    const question = sortedQuestions[i];
    const answer = matchQuestionToProfileField(question.label, clientProfile);
    
    if (answer) {
      result.preFilledAnswers.push(answer);
      result.preFilledQuestions.push(question.label);
      result.nextQuestionIndex = i + 1;
      result.hasPrefilledData = true;
    } else {
      // Stop at first question we can't answer
      break;
    }
  }
  
  return result;
}

/**
 * Generates a context-aware welcome message explaining what was pre-filled
 */
export function generateContextWelcomeMessage(
  toolTitle: string,
  clientProfileName: string,
  preFilledQuestions: string[],
  preFilledAnswers: string[]
): string {
  if (preFilledQuestions.length === 0) {
    return `Hello! I'm ready to help you with ${toolTitle}. Let's get started.`;
  }
  
  const preFilledList = preFilledQuestions
    .map((question, index) => `• **${question}**: ${preFilledAnswers[index]}`)
    .join('\n');
  
  return `Hello! I'm ready to help you with ${toolTitle}.

Based on your selected client profile "${clientProfileName}", I've automatically filled in the following information:

${preFilledList}

This saves you time and ensures consistency with your client's requirements. Let's continue with the remaining questions.`;
}

/**
 * Generates message for when all questions are pre-filled
 */
export function generateAllPrefilledMessage(
  toolTitle: string,
  clientProfileName: string
): string {
  return `Perfect! I have all the information I need from your client profile "${clientProfileName}". What would you like me to create for ${clientProfileName}?`;
}