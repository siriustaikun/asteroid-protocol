import { Component } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { IonButton, IonHeader, IonToolbar, } from '@ionic/angular/standalone';
import { Chain } from '../core/types/zeus';
import { environment } from 'src/environments/environment';
import { CommonModule, DatePipe } from '@angular/common';
import { ShortenAddressPipe } from '../core/pipe/shorten-address.pipe';
import { HumanSupplyPipe } from '../core/pipe/human-supply.pipe';
import { TokenDecimalsPipe } from '../core/pipe/token-with-decimals.pipe';
import { CFT20Service } from '../core/metaprotocol/cft20.service';
import { IonicModule, AlertController, ModalController } from '@ionic/angular';
import { TransactionFlowModalPage } from '../transaction-flow-modal/transaction-flow-modal.page';
import { interval } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { WalletService } from '../core/service/wallet.service';
import { WalletRequiredModalPage } from '../wallet-required-modal/wallet-required-modal.page';

@Component({
  selector: 'app-mint',
  templateUrl: 'mint.page.html',
  styleUrls: ['mint.page.scss'],
  standalone: true,
  imports: [IonicModule, RouterModule, CommonModule, ShortenAddressPipe, DatePipe, HumanSupplyPipe, TokenDecimalsPipe],
})
export class MintPage {
  isLoading = false;
  token: any;
  tokenLaunchDate: Date;
  tokenIsLaunched: boolean = false;
  countdown: string = '';

  constructor(private activatedRoute: ActivatedRoute, private protocolService: CFT20Service, private modalCtrl: ModalController, private alertController: AlertController, private walletService: WalletService) {
    this.tokenLaunchDate = new Date();
  }

  async ngOnInit() {
    this.isLoading = true;
    const chain = Chain(environment.api.endpoint)

    const result = await chain('query')({
      token: [
        {
          where: {
            ticker: {
              _eq: this.activatedRoute.snapshot.params["ticker"].toUpperCase() // Always stored in uppercase
            }
          }
        }, {
          id: true,
          height: true,
          transaction: {
            hash: true
          },
          creator: true,
          current_owner: true,
          name: true,
          ticker: true,
          decimals: true,
          max_supply: true,
          per_mint_limit: true,
          launch_timestamp: true,
          content_path: true,
          content_size_bytes: true,
          date_created: true,
          circulating_supply: true,
        }
      ]
    });

    this.token = result.token[0];
    this.tokenLaunchDate = new Date(this.token.launch_timestamp * 1000);
    if (this.tokenLaunchDate.getTime() < Date.now()) {
      this.tokenIsLaunched = true;
    } else {
      this.startCountdown();
    }
    this.isLoading = false;
  }

  async mint() {
    if (!this.walletService.hasWallet()) {
      const modal = await this.modalCtrl.create({
        keyboardClose: true,
        backdropDismiss: true,
        component: WalletRequiredModalPage,
        cssClass: 'wallet-required-modal',
      });
      modal.present();
      return;
    }

    // Construct metaprotocol memo message
    const params = new Map([
      ["tic", this.token.ticker],
      ["amt", this.token.per_mint_limit],
    ]);
    const urn = this.protocolService.buildURN(environment.chain.chainId, 'mint', params);
    const modal = await this.modalCtrl.create({
      keyboardClose: true,
      backdropDismiss: false,
      component: TransactionFlowModalPage,
      componentProps: {
        urn,
        metadata: null,
        data: null,
        routerLink: ['/app/manage/token', this.token.transaction.hash],
        resultCTA: 'View transaction',
        metaprotocol: 'cft20',
        metaprotocolAction: 'mint',
      }
    });
    modal.present();
  }

  startCountdown() {
    interval(1000)
      .pipe(
        startWith(0),
        map(() => {
          const now = new Date();
          const distance = this.tokenLaunchDate.getTime() - now.getTime();
          if (distance < 0) {
            return '00:00:00:00';
          }
          const days = Math.floor(distance / (1000 * 60 * 60 * 24));
          const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((distance % (1000 * 60)) / 1000);

          if (days === 0 && hours === 0 && minutes === 0 && seconds === 0) {
            this.tokenIsLaunched = true;
          }

          return `${days}d ${hours}h ${minutes}m ${seconds}s`;
        })
      )
      .subscribe(countdown => this.countdown = countdown);
  }
}
