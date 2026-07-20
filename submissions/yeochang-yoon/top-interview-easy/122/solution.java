class Solution {
    public int maxProfit(int[] prices) {

        int sum = 0;
        int price = prices[0];
        for(int i = 1; i < prices.length; i++){
            if(prices[i] > price){
                sum += prices[i] - price;
                price = prices[i];
            } else {
                price = prices[i];
            }
        }

        return sum;
    }
}