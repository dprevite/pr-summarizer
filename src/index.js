const core = require('@actions/core');
const github = require('@actions/github');
const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');

async function run() {
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
    const changes = files.map(file => ({
      filename: file.filename,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
      patch: file.patch
    }));

    // Generate description using AI
    let description;
    if (modelProvider === 'anthropic' && anthropicApiKey) {
      const anthropic = new Anthropic({ apiKey: anthropicApiKey });
      const response = await anthropic.messages.create({
        model: model || 'claude-3-sonnet-20240229',
        messages: [{
          role: 'user',
          content: `Please generate a clear and concise pull request description based on these changes:\n${JSON.stringify(changes, null, 2)}`
        }],
        max_tokens: 1000
      });
      description = response.content[0].text;
    } else {
      const openai = new OpenAI({ apiKey: openaiApiKey });
      const response = await openai.chat.completions.create({
        model: model || 'gpt-4',
        messages: [{
          role: 'user',
          content: `Please generate a clear and concise pull request description based on these changes:\n${JSON.stringify(changes, null, 2)}`
        }]
      });
      description = response.choices[0].message.content;
    }

    // Get existing PR description
    const { data: pr } = await octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
    });

    // Only update if there's no existing description
    if (!pr.body) {
      await octokit.rest.pulls.update({
        owner,
        repo,
        pull_number: prNumber,
        body: description
      });
      core.info('Successfully updated PR description');
    } else {
      core.info('PR already has a description, skipping update');
    }

  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
