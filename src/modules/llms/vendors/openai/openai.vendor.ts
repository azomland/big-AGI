import { backendCaps } from '~/modules/backend/state-backend';

import { OpenAIIcon } from '~/common/components/icons/OpenAIIcon';
import { apiAsync, apiQuery } from '~/common/util/trpc.client';

import type { IModelVendor } from '../IModelVendor';
import type { OpenAIAccessSchema } from '../../server/openai/openai.router';
import type { VChatMessageOrFunctionCallOut } from '../../llm.client';
import { unifiedStreamingClient } from '../unifiedStreamingClient';

import { OpenAILLMOptions } from './OpenAILLMOptions';
import { OpenAISourceSetup } from './OpenAISourceSetup';


// special symbols
export const isValidOpenAIApiKey = (apiKey?: string) => !!apiKey && apiKey.startsWith('sk-') && apiKey.length > 40;

export interface SourceSetupOpenAI {
  oaiKey: string;
  oaiOrg: string;
  oaiHost: string;  // use OpenAI-compatible non-default hosts (full origin path)
  heliKey: string;  // helicone key (works in conjunction with oaiHost)
  moderationCheck: boolean;
}

export interface LLMOptionsOpenAI {
  llmRef: string;
  llmTemperature: number;
  llmResponseTokens: number;
}

export const ModelVendorOpenAI: IModelVendor<SourceSetupOpenAI, OpenAIAccessSchema, LLMOptionsOpenAI> = {
  id: 'openai',
  name: 'OpenAI',
  rank: 10,
  location: 'cloud',
  instanceLimit: 1,
  hasBackendCap: () => backendCaps().hasLlmOpenAI,

  // components
  Icon: OpenAIIcon,
  SourceSetupComponent: OpenAISourceSetup,
  LLMOptionsComponent: OpenAILLMOptions,

  // functions
  getTransportAccess: (partialSetup): OpenAIAccessSchema => ({
    dialect: 'openai',
    oaiKey: '',
    oaiOrg: '',
    oaiHost: '',
    heliKey: '',
    moderationCheck: false,
    ...partialSetup,
  }),

  // List Models
  rpcUpdateModelsQuery: (access, enabled, onSuccess) => {
    return apiQuery.llmOpenAI.listModels.useQuery({ access }, {
      enabled: enabled,
      onSuccess: onSuccess,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
    });
  },

  // Chat Generate (non-streaming) with Functions
  rpcChatGenerateOrThrow: async (access, llmOptions, messages, functions, forceFunctionName, maxTokens) => {
    const { llmRef, llmTemperature = 0.5, llmResponseTokens } = llmOptions;
    try {
      return await apiAsync.llmOpenAI.chatGenerateWithFunctions.mutate({
        access,
        model: {
          id: llmRef!,
          temperature: llmTemperature,
          maxTokens: maxTokens || llmResponseTokens || 1024,
        },
        functions: functions ?? undefined,
        forceFunctionName: forceFunctionName ?? undefined,
        history: messages,
      }) as VChatMessageOrFunctionCallOut;
    } catch (error: any) {
      const errorMessage = error?.message || error?.toString() || 'OpenAI Chat Generate Error';
      console.error(`openai.rpcChatGenerateOrThrow: ${errorMessage}`);
      throw new Error(errorMessage);
    }
  },

  // Chat Generate (streaming) with Functions
  streamingChatGenerateOrThrow: unifiedStreamingClient,

};
