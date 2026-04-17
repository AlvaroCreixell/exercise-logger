# Workout Routine GPT Builder Kit

This folder is a practical setup for a ChatGPT Custom GPT that designs workout routines for this project.

Use a Custom GPT with Instructions + Knowledge for this workflow. Do not treat this as a fine-tuning problem unless you later move the logic into the API and want model customization there.

## Recommended Knowledge Files

Upload these files to the GPT's Knowledge section:

1. `docs/custom-gpt/routine-yaml-contract.md`
2. `docs/custom-gpt/exercise-catalog-reference.md`
3. `web/data/routines/full-body-3day.yaml`

Optional:

4. `web/src/data/catalog.csv`

The first two files are retrieval-friendly versions of the real schema and catalog. The bundled YAML file gives the GPT a complete in-project example to imitate.

## Recommended Instructions Source

Paste the contents of `docs/custom-gpt/workout-routine-gpt.instructions.md` into the GPT Instructions field.

## Suggested GPT Configuration

- Name: `Exercise Logger Routine Designer`
- Description: `Designs personalized workout routines as valid Exercise Logger YAML files.`
- Conversation starters:
  - `Build me a 3-day hypertrophy routine for 60-minute sessions.`
  - `Make me a 2-day beginner routine with mostly machines and cables.`
  - `Rewrite my current routine into valid Exercise Logger YAML.`

## Capabilities

- Enable `Code Interpreter & Data Analysis` if you want the GPT to generate a downloadable `.yaml` file.
- Knowledge files are enough for schema guidance, examples, and catalog lookup.

## Important Limitation

Knowledge improves consistency, but it is not a hard validator. If you need guaranteed-valid YAML every time, the next step is to add an Action that sends the drafted YAML to a validator endpoint backed by this project's `validateAndNormalizeRoutine` logic.
