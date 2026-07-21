class Solution {
    public boolean isValidSudoku(char[][] board) {

        for(int i = 0; i < 9; i++){
            int[] num1 = new int[9];
            int[] num2 = new int[9];
            for(int j = 0; j < 9; j++){
                if(board[i][j] >= '1' && board[i][j] <= '9'){
                    num1[board[i][j] - '1']++;
                    if(num1[board[i][j] - '1'] > 1){
                        return false;
                    }
                }
                if(board[j][i] >= '1' && board[j][i] <= '9'){
                    num2[board[j][i] - '1']++;
                    if(num2[board[j][i] - '1'] > 1){
                        return false;
                    }
                }
            }
        }

        //1,1 | 1,4 | 1,7 | 4,1 | 4,4 | 4,7 | 7,1 | 7,4 | 7,7

        int[][] box = {
                {1,1}, {1,4}, {1,7},
                {4,1}, {4,4}, {4,7},
                {7,1}, {7,4}, {7,7}};

        int[] dr = {-1, -1, -1, 0, 0, 1, 1, 1, 0};
        int[] dc = {-1, 0, 1, -1, 1, -1, 0, 1, 0};

        for(int i = 0; i < 9; i++){
            int[] num = new int[9];
            for(int j = 0; j < 9; j++){
                int r = box[i][0] + dr[j];
                int c = box[i][1] + dc[j];

                if(board[r][c] >= '1' && board[r][c] <= '9'){
                    num[board[r][c] - '1']++;
                    if(num[board[r][c] - '1'] > 1){
                        return false;
                    }
                }
            }
        }

        return true;
    }//Solution
}