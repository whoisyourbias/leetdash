class Solution {
    public String countAndSay(int n) {

        if(n == 1){
            return "1";
        }

        String str = countAndSay(n-1);

        int len = str.length();

        String result = "";

        int count = 1;
        for(int i = 0; i < len-1; i++){
            if(str.charAt(i) == str.charAt(i+1)){
                count++;
            } else{
                result += count;
                result += str.charAt(i);
                count = 1;
            }
        }

        result += count;
        result += str.charAt(len-1);

        return result;
    }
}