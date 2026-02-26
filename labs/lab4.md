# Lab 4 | Tuning ASR and TTS

In this lab session you will practice styling TTS output using Speech Synthesis Markup Language (SSML) and tuning ASR. It is assumed that you have read the relevant literature on the subject before attempting to solve the assignments:

For reference:
- Speech Synthesis Markup Language (SSML) Version 1.0, W3C Recommendation 7 September 2004, http://www.w3.org/TR/speech-synthesis/
- Azure Text-to-Speech: [Docs](https://docs.microsoft.com/en-us/azure/cognitive-services/speech-service/index-text-to-speech), [Speech Studio](https://speech.microsoft.com/) (audio content creation)
- Azure Speech-to-Text: [Docs](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/index-speech-to-text), [Speech Studio](https://speech.microsoft.com/) (custom speech)

> **⚠️ NB**
> 
> - For a **VG** point you need to do **either** Part A-VG or Part B-VG. You don't have to do both VG parts.
> - If you have problems accessing your Azure account (namely, the portal and [Speech Studio](https://speech.microsoft.com/)) contact Vlad/Bora/Tal/Tom immediately and we work out the solution. You can ideally use Canvas' discussion section so that we see every possible error and prepare a solution for everyone and for future reference in this course. In the meanwhile you can team up with your classmate and work on the assignment together.

## Part A: Hard cases for Speech Recognition

You may have noticed that the automatic speech recognizer we used so far `(Reference: Lab 3 Project)` does not always transcribe what we were expecting. Take a look at the following. After trying a couple of times, the name of Hungarian composer _Franz Listz_ and the scientific name of the Magnolia tree, _Magnolia liliflora_, were detected. The accent of the person speaking may play a role in recognition.

- First attempt: { confidence: 0.52745277, utterance: "Composer. France List" }
- Fourth attempt: { confidence: 0.75028044, utterance: "Composer Franz Liszt" }

- First try: { confidence: 0.661772, utterance: "The plant is Magnolia Lily flora"}
- After some attempts: { confidence: 0.7240172, utterance: "The plant is Magnolia lilliflora"}

In this case "confidence" means how sure our speechstate is of your utterance. Speechstate prints this out to the console log everytime it hears something.

Let's say, you said "Dumbledore" while your dialogue machine was listening, if you see {confidence: 0.75, utterance: "Dumbledore" } this means your machine is 75% sure that what you said can be transcribed with the string "Dumbledore".

(Next step should be done when you test your project in the browser after running `npm run dev` and opening the project in your browser with `O + Enter`)

Note: Explore the data structure of our `context`: `State context`. An easy way to check that is to tinker with your browser's `developer console`. You may be familiar with the console given that you needed to use it for debugging your Lab 3 project. If you are not, there are some key combinations you can try to open the `developer console` on your OS (Operating System) and your browser type for your reference below:

Try F12 (or Fn + F12 if you prefer to use your function buttons that way). Or:
| Browser | Windows/Linux Shortcut | macOS Shortcut |
|---------|------------------------|----------------|
| Chromium-Based | `Ctrl` + `Shift` + `J` or `I` | `Cmd` + `Option` + `J` or `I`
| Firefox-Based | `Ctrl` + `Shift` + `K` | `Cmd` + `Option` + `K`
| Safari | :D | `Cmd` + `Option` + `C` |

Now, after your dialogue system activates ASR, check the data structure of `State context:` via clicking the arrows next to the Object in your `developer console`. Find where the `confidence` score is located. How is its value stored? How can you use/call that value via TypeScript in your projects?

1) Now, try similar cases and reflect on the outcome:
   - Can you think of any names of fictional places, people or objects that are not recognized? (Keep your final project in mind!)
   - If not, can you try any scientific names for plants, animals, geologic terms, etc., or names for classic musical pieces and authors?
   - Are there any real location names or names of people that are also not properly transcribed?
   - Do you think any specific accent you are using makes words difficult to process?
     
2) Write some sample code to show confidence scores in speech recognition, or you can log it in the console. How good are those scores?

3) Think about how this problem, transcription of something we did not intent to say, could be solved. Why do you think recognition falters in the examples that you tried?

4) Write a very brief (half-page) report on your experience with ASR for your case-study. Save it as `lab4A.md` in the root directory of your project (or `.txt` or `.pdf`, just not a Word document).

### Part A-VG. Azure Custom Speech

1) To solve the problem you will use [Custom Speech](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/custom-speech-overview):
   - You will basically have to provide data, either plain text or audio files, to help the recognition process.
   - Train and deploy your model (enable content logging). Note the **Endpoint ID**.

2) To test your model:
   - Create a file `dm4.ts` which implements a very basic ASR test (analogous to `dm.ts` in this repository). Add the following to your `settings` object:
     ```javascript
     speechRecognitionEndpointId: "paste your Endpoint ID here",
     ```
   - Now you can test your new ASR model! You will be able to download the log files for your model in Custom Speech interface.

3) Extend the your report with the following information:
   - Which new words are now supported and can be tested. Report should contain your Endpoint ID.

## Part B: Using SSML - Speech Synthesis Poetry Slam!

> A poetry slam is a competition at which poets read or recite original work (or, more rarely, that of others). These performances are then judged on a numeric scale by previously selected members of the audience. (Wikipedia)

Your task in this assignment is to use SSML in Azure Audio Content Creation in order to get an artificial poet to recite the your favourite poem (just a couple of verses) with a speed and **in "a style" similar to the way how it is read by an actor** (or by a poet her/himself).

You can refer to some poetry performance found on YouTube or elsewhere.

### Part B-VG

This VG Part is about polishing what you already built!

Take a greater effort and take it to next level. And SSML has a lot of tools. Be creative! You can experiment with adding things like styles, custom voices, multiple languages, background audio etc. [See the documentation.](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/speech-synthesis-markup-voice)

Sources for inspiration:
- [California Dreaming](https://www.youtube.com/watch?v=IZYoGj8D8pY) (386DX art project).
- [Without Me](https://raw.githubusercontent.com/vladmaraev/rasa101/master/withoutme.m4a), by Robert Rhys Thomas in 2019 for this course.
- [Bad Guy](https://raw.githubusercontent.com/GU-CLASP/dialogue-systems-1-2026/main/labs/lab4/media/partC_badguy_voiced.mp3), by Fang Yuan in 2020 for this course.

## Submission

In your submission provide:
1) report for Part A (and A-VG) and your project files on `/Code`.
2) text file with your SSML code (`Code/lab4.txt`); in the beginning of the file include the reference to the original performance. If you have done Part B-VG, mention that.
3) audio file for Part B (`Code/lab4.mp3`)

These files can be placed in your Github repository.

- **Work on the new folder created for this lab:** lab4. You have to click Sync Fork on your github account and type command "git pull" in your local so that your local is in sync with the fork you just synched.
- **Commit** your changes and **push** them to your repository (your fork of this repository)
- **Rename the pull request** to "Lab 3 & 4 submission" (if you want to ask a question about your code, use the title "Lab 3 & 4 work in progress").
- On Canvas, submit the pull request URL.

