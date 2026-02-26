
# Lab 5 | Natural language understanding

*Before you proceed*: pull the changes to your fork and update packages to the latest version in the correct directory (labs/lab5/Code):
```sh
npm install
```  

If something is broken/corrupted try removing all the packages and re-install:
```sh
rm -rf node_modules package-lock.json
npm install
npm install xstate
npm install speechstate@latest
npm install @statelyai/inspect
```  

## Introduction & Preparation
In this lab, we are going to build on what you have already built on lab3 (or rather lab3fixed!) except this machine will be smarter. We will achieve this with Natural Language Understanding (NLU) module of NLU.
Remember that in the Lab 3, our machine expected very specific utterances. And we had to write EVERY word we would use in our Grammar object which was tedious. But real language have tens of thousands of words and it is unreasonable to construct a grammar that large!
With NLU, we will be able add two more objects instead of Grammars: Intents and Entities. They are arrays that Azure will expect and those arrays will guide our machine to understand a given utterance with the confidence scores.

As it is stated before, this will be on top of your lab 3 assignment, so it is a good idea to copy your dm.ts on top of it and start making changes from there.

However types.ts will expect additional type declarations. Remember that we said we will add two more objects: Intent and Entity. And also remember that TypeScript requires explicit type declarations for its expected objects. 

It is up to you to update your types.ts. However, you may simply add these to make your life much easier.

Firstly add this Entity object type to your types.ts. 

```typescript
export interface Entity { // This is the type of the entities array in the NLUObject. 
  category: string;
  text: string;
  confidenceScore: number;
  offset: number;
  length: number;
}
```  
As evident, all our Entity objects will tell us their "category"s and their contents (in "text") along with their confidence scores (how sure the NLU is about its guess).

Secondly, we need the Intent object type. So please add this too. It will only possess a category and a confidence score for its prediction.

```typescript
export interface Intent { // This is the type of the intents array in the NLUObject.
  category: string;
  confidenceScore: number;
}
```

Now what is left is to present these two in a presentable format. For that we can use the NLUObject below. So please add this too.

```typescript
export interface NLUObject { // This is the type of the interpretation in the DMContext.
  entities: Entity[];
  intents: Intent[];
  projectKind: string;
  topIntent: string;
}
```

Finally we need to add that to our DMContext type! Add this final type in your DMContext{} type:

```typescript
  interpretation: NLUObject | null;
```

After we completed our Intent and Entity additions as an NLU Object, 

Now NLUObject (which contains our Intent and Entity types) are inside our DMContext. So when we export our DMContext


## Task 1: Integrate a statistical NLU in your dialogue system
In Lab 3 (basic dialogue management), you used a simplistic mapping
(called *grammar* in the code) from user utterances to entities. In the
first task of this lab, you will replace this grammar with a
statistical NLU trained and deployed using Conversational Language
Understanding (CLU) in Azure.

### 1) Create a NLU project in Azure
  Go to https://language.cognitive.azure.com/ and ensure that you are
  signed in with your Azure account.  Choose "Create new ->
  Conversational language understanding". As part of this, you may
  need to create a new Azure language resource.  Note that resource
  names are unique across the entire Azure platform, so you may need
  to include some arbitrary digits or numbers in it
  (e.g. *language_resource_57372*).

  You need to check that the region for your language resource is available in [this list](https://learn.microsoft.com/en-us/azure/ai-services/language-service/concepts/regional-support#conversational-language-understanding-and-orchestration-workflow). You need to see ticks on both columns.

  As project name, you can e.g. enter: *appointment*.

### 2) Add intents 
  In the "Schema definition" menu of your project you will find the
  option to create Intents and Entities. Intents are a result of
  automatic classification of sentences (or expressions) performed by
  a model/machine.  In order to get the model to recognize your
  intents, you will have to train them first with examples of what
  sentences with such intents look like. The model will average those
  sentences to infer your intents. We won't use entities until point
  (5).

- Example:
  - Intent: Book a restaurant
  - Example utterance: "I'd like to make a reservation for tonight."
  - Example utterance: "Find me a good Italian place nearby."

First, create two intents, corresponding to "create a meeting" and
"who is X" (X = name of a famous person). Make sure to use the same
names for these intents as you do in your code.  Then, choose "Data
labeling" in the navigation menu to the left and add around 10
training examples for each intent. (At this stage, you can come up
with examples on your own. You can improve the training data later.)

To train the model for the first time, choose "Training jobs" in the
navigation menu and select "Train a new model". As model name, you can
choose *appointment*. (When you re-train the model later on, select
"Overwrite an existing model".)

### 3) Deploy the model
  In order to use your trained model in your dialogue system, you
  first need to deploy it. Choose "Deploying a model" in the
  navigation menu and then "Add deployment". Again, as deployment name
  you can choose *appointment*. (When you re-train your model later on
  and want to re-deploy it, overwrite the existing deployment name.) 
  After deploying, you can see the URL of your deployment by selecting 
  the model and clicking on "Get prediction URL". You will need it in 
  step 4.3 below.

### 4) Integrate the model


1. As we have said, you can copy stuff from Lab 3.

2. Configure your NLU by adding the following to your files:
   - create a **NLU_KEY** const in your *azure.ts* file and import it
     (together with your **KEY**).
   - In *dm.ts*, create the object "azureLanguageCredentials":
     ```typescript

       const azureLanguageCredentials = {
         endpoint: "" /** your Azure CLU prediction URL */,
         key: NLU_KEY /** reference to your Azure CLU key */,
         deploymentName: "" /** your Azure CLU deployment */,
         projectName: "" /** your Azure CLU project name */,
       };
     ```

  
   - To your *settings* const add said object:

     ```typescript
       const settings = {
         azureLanguageCredentials: azureLanguageCredentials /** global activation of NLU */,
         azureCredentials: azureCredentials,
         asrDefaultCompleteTimeout: 0,
         asrDefaultNoInputTimeout: 5000,
         locale: "en-US",
         ttsDefaultVoice: "en-US-DavisNeural",
       };
     ```

4. Whenever you need to use Azure CLU, add the following parameter to
   *LISTEN* event.
   ```typescript
     ({ context }) =>
            context.ssRef.send({
              type: "LISTEN",
              value: { nlu: true } /** Local activation of NLU */,
            }),
   ```

   This enables *RECOGNISED* events to contain NLU results (accessible
   via *event.nluValue*).

Finally, you need to rewire the logic in your code to support 2 aforementioned intents. 


### 5) Adding entities
Entities are specific names (named entities) such as locations,
people, organizations... and other concepts such as emotions,
opinions... and are used to extract meaningful information from
sentences.  A sentence such as "Get tickets for Taylor Swift's concert
in Sweden" could be classified as "Intent: Buy tickets" and have the
entities "Artist: Taylor Swift", "Country: Sweden".  You can read more
about labeling here:
https://learn.microsoft.com/en-us/azure/ai-services/language-service/conversational-language-understanding/how-to/tag-utterances?tabs=portal

To get started, go back to "Schema definition" and add the entities
that you need. For example, in the case of the appointment intent, you
can have entities such as: "meeting title", "meeting time", "yes/no",
etc. Again, entity names should correspond to those in your code.

There are two ways of creating entities: by the "Schema definition"
menu or inside "Data labeling".

1. For the first option, you can select pre-built entities or give a
   list with your entities.

2. For the last option, by hovering over a sentence that has been
   used/is going to be used as training for your intent, an opening
   square bracket will appear, this marks the start of the
   entity. After clicking, a closing square bracket will appear, then
   you can click to choose the end of what you consider an entity. By
   training the model with such labeled entities, the model will (try
   to) learn the pattern of what they are.

You can experiment and choose the most appropriate method for each
entity.

Finally, you need to rewire the logic in your code to support
entities. For "who is X" path, in response to user's query you will
need to provide some basic information about the person (i.e. a
celebrity).

### 6) Testing Deployments

Test your deployments. It is very helpful for debugging. It will help you understand if any error is on Azure's side or your Typescript project's side. If everything seems fine on `Testing deployments` section in the web interface, it is likely that your files on lab5 directory needs adjustment.

## Submit:
Export your NLU project by choosing “Projects” in the navigation menu
to the left, then select your project and click Export. (You might
need to unblock a pop-up window.) Save the exported content as a JSON
file (.json extension). JSON file should be placed in your Github repository.

- *Commit* your changes (with a commit message indicating that you have done Lab5)  and *push* them to your
  repository (your fork of this repository), if you have already done your Pull Request before, pushing your changes will automatically update your Pull Request and we can see them.
- Change the title of your Pull Request to "Lab 5 submission" (if you want to ask a question about
  your code, use the title "Lab 5 work in progress").
- On Canvas, submit the pull request URL.



