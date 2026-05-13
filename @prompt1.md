# Japanese Numbers Trainer

The idea of this project is to create a small application that trains comprehension of spoken japanese numbers to train quick understanding of numbers like phone numbers, prices, room numbers.

The application should prompt for length of nunber and how many questions to include in a sequence.
It should generate the requested number of random numbers and then start prompting them in round robin fashion reading them aloud and prompting the user to type the number.  On success the number should be removed from the sequence.  Ideally this should provide some audible feedback with a nice confirming sound on success and a negative error sound on failure.

The application should ideally be fully client side and run equally on laptop and mobile with small displays.  I would upload it to github so that I can click on it whereever I am.

We should support following:
- User can give length of sequence. Default 10
- User can give length of number
- User can choose to train sequence of digits like phone number or full number 

Challenges:
- Where to get the soundbites so that we can assemble any japanese number.
- Has to run serverless just client side.
- Can we make this work offline ( not required )
- Can we share on github. No license infringement for soundbites etc...

Lets discuss the options and tradeoffs we have before we start.

Also before we start and before I create a repo on my gitlab and on github I randomly chose a name of "bango" for this project.  Any better ideas from a japanese point of view. 



