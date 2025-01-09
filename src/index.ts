import * as core from '@actions/core';
import * as github from '@actions/github';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

interface FileChange {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
}

async function run(): Promise<void> {
  try {
    // Get inputs
    const githubToken = core.getInput('github-token', { required: true });
    const openaiApiKey = core.getInput('openai-api-key');
    const anthropicApiKey = core.getInput('anthropic-api-key');
    const modelProvider = core.getInput('model-provider');
    const model = core.getInput('model');

    // Initialize GitHub client
    const octokit = github.getOctokit(githubToken);
    const context = github.context;

    if (!context.payload.pull_request) {
      throw new Error('This action can only be run on pull request events');
    }

    // Get PR details
    const prNumber = context.payload.pull_request.number;
    const owner = context.repo.owner;
    const repo = context.repo.repo;

    // Fetch PR files
    const { data: files } = await octokit.rest.pulls.listFiles({
      owner,
      repo,
      pull_number: prNumber,
    });

    // Get PR diff summary
    const changes: FileChange[] = files.map(file => ({
      filename: file.filename,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
      patch: file.patch
    }));

    // Generate description using AI
    let description: string;
    if (modelProvider === 'anthropic' && anthropicApiKey) {
      const anthropic = new Anthropic({ apiKey: anthropicApiKey });
      const response = await anthropic.messages.create({
        model: model || 'claude-3-sonnet-20240229',
        system: "You are a helpful assistant that creates clear and concise pull request descriptions.",
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: `Please generate a clear and concise pull request description based on these changes:\n${JSON.stringify(changes, null, 2)}`
        }]
      });
      
      if (!response.content) {
        throw new Error('Unexpected response format from Anthropic API');
      }
      description = response.content.map(block => block.text).join('');
    } else if (openaiApiKey) {
      const openai = new OpenAI({ apiKey: openaiApiKey });
      const response = await openai.chat.completions.create({
        model: model || 'gpt-4',
        messages: [{
          role: 'user',
          content: `Please generate a clear and concise pull request description based on these changes:\n${JSON.stringify(changes, null, 2)}`
        }]
      });
      
      if (!response.choices?.[0]?.message?.content) {
        throw new Error('Unexpected response format from OpenAI API');
      }
      description = response.choices[0].message.content;
    } else {
      throw new Error('Either OpenAI or Anthropic API key must be provided');
    }

    // Get existing PR description
    const { data: pr } = await octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
    });

    // Create a header for the AI-generated description
    const aiHeader = `\n\n## 🤖 PR Summarizer\n\n`;
    const aiDescription = aiHeader + description;

    // Update PR description
    const existingBody = pr.body || '';
    
    // Check if there's already an AI-generated section
    const aiSectionRegex = /\n\n## 🤖 PR Summarizer/;
    const updatedBody = aiSectionRegex.test(existingBody)
      ? existingBody.replace(aiSectionRegex, aiHeader) + description
      : existingBody + aiDescription;

    await octokit.rest.pulls.update({
      owner,
      repo,
      pull_number: prNumber,
      body: updatedBody
    });
    
    core.info('Successfully updated PR description');
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('An unexpected error occurred');
    }
  }
}

run();
