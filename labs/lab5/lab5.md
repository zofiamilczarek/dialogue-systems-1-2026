# My solution to lab5

The core of the program is in the `HandleNlu` state which asks the user what they want to do and then transitions into other states based on user intent.

My NLU module JSON is in `Code/nlu.json`

## Celebrity

To handle the Celebrity-related questions, I created a `WhoIsX` intent. If my system detects it, it will go the `CheckCelebrity` state and tell you a fact about one of the pre-defined celebrities: Taylor Swift, Ed Sheeran and Leonardo DiCaprio. This feature could be extended with an API call to some wikipedia-type database to be able to get answers on all celebrities. 


## Meeting

To move to meeting creation, I created the `CreateMeeting` intent. If it is detected, the state moves to `HandleMeeting`. Additionally, if the user says something like 'I want to create a meeting on Thursday', the program will already save the date and only continue to ask for missing details (i.e. name and time). If all the fields are filled the machine will go to a `ConfirmMeeting` state.


## Limitations

In its current state, the system doesn't have a good repair solution - if the ASR does a mistake (i.e. transcribe Vlad as flat...), the system will keep saying 'I can't hear you' instead of going into some error repair. This could be improved by adding error repair modules which say 'Please repeat the name, I didn't hear it' or something like that.