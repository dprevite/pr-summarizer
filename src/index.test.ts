import * as core from '@actions/core';
import * as github from '@actions/github';
import {jest} from '@jest/globals';

// Mock the external modules
jest.mock('@actions/core');
jest.mock('@actions/github');
jest.mock('openai');
jest.mock('@anthropic-ai/sdk');

describe('PR Summarizer Action', () => {
    beforeEach(() => {
        // Clear all mocks before each test
        jest.clearAllMocks();

        // Setup default mock values
        (github.context as any) = {
            payload: {
                pull_request: {
                    number: 1
                }
            },
            repo: {
                owner: 'test-owner',
                repo: 'test-repo'
            }
        };
    });

    it('should throw error if not run on a PR', async () => {
        // Remove PR from payload
        (github.context as any).payload.pull_request = undefined;

        // Import the module after setting up mocks
        await import('./index');

        // Verify error was set
        expect(core.setFailed).toHaveBeenCalledWith(
            'This action can only be run on pull request events'
        );
    });

    // Add more tests as needed
});
