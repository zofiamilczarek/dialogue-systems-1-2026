To do the case-study, I modified the state machine so that I can repeatedly give it different phrases to test, and the system will tell me what it transcribed and with what confidence. This functionality is implemented with the `TestASR` and `SayConfidence` states. 

To see where the ASR breaks, I tried a collection of different names, scientific terms and places. For names I chose Frederic Chopin, Arsene Lupin and my own name, Zofia Milczarek. The choice of names is motivated by their difficulty : Chopin is very famous so his name appears in a lot of the training data. Arsene Lupin less so, and on top of that the name is French, so potentially even more out of domain of the ASR model. Finally my own name, which is both polish and not that common, is the hardest for the system.

Indeeed the system was not able to transcribe my full name correctly at all. Here are some outputs, where I tried with different accents etc. :

```
{ utterance: "Zofia Milcharek", confidence: 0.061554663 }
{ utterance: "Zafia Milchark", confidence: 0.09349169 }
{ utterance: "Zofia Mircharek", confidence: 0.1158996 }
```

While it is able to transcribe my first name correctly in most cases, it was impossible for it to get the surname right. This is probably because, while there will be enough different people named Zofia in the training data, my surname is pretty rare even for Poland. This causes the ASR to keep transcribing it incorrecly. 

For Arsène Lupin, the ASR was able to work well, but it had a pretty low confidence score. Interestingly, when I tried to pronounce the name with a more "American" accent, the ASR struggled more. First it gave an incorrect transcription, and then it gave the correct one but with a lower confidence. 

```
{ utterance: "Arsene Lupin", confidence: 0.14095934 } # french accent
{ utterance: "Arson DuPont", confidence: 0.16023728 } # more american accent
{ utterance: "Arsene Lupin", confidence: 0.09474846 } # more american accent
```

Now none of this was a problem for transcribing Frederic Chopin. After trying it with multiple different pronounciations (a polish, french and english one), I found that it is always able to transcribe this name correctly, and with high confidence (around 0.5-0.6). 

When it comes to the solution of this problem, it depends on our use-case. If we know the vocabulary of our target use-case, it will probably be worth it to fine-tune our model on some speech-transcription pairs. On the other hand, no matter the amount of training we do, we always run the risk of encountering a user with an unexpected accent or verbiage. To handle those cases, it is important to design a failure mode for our system, which will allow the user to correct the system in some way, for example by the system asking to confirm the user's input.





